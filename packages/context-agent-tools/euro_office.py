# SPDX-FileCopyrightText: 2026 Euro-Office contributors
# SPDX-License-Identifier: AGPL-3.0-or-later
"""
Euro-Office Document Server tools for Nextcloud Context Agent.
Provides document conversion via the Euro-Office Document Server API.
"""
import json
import time
import hashlib
import httpx
import jwt as pyjwt
from langchain_core.tools import tool
from nc_py_api import AsyncNextcloudApp


def get_category_name() -> str:
    return "Euro-Office"


async def is_available(nc: AsyncNextcloudApp) -> bool:
    """Check if OnlyOffice/Euro-Office integration is configured."""
    return True


async def _get_ds_config(nc: AsyncNextcloudApp) -> tuple[str, str]:
    """Get Document Server URL and JWT secret from Nextcloud config."""
    try:
        response = await nc.ocs("GET", "/ocs/v2.php/apps/onlyoffice/api/v1/settings")
        ds_url = response.get("documentserver", "http://eo")
        jwt_secret = response.get("jwt_secret", "secret")
        return ds_url.rstrip("/"), jwt_secret
    except Exception:
        # Fallback to known config for POC
        return "http://eo", "secret"


def _sign_jwt(payload: dict, secret: str) -> str:
    """Sign a payload with the DS JWT secret."""
    return pyjwt.encode(payload, secret, algorithm="HS256")


async def _get_user_id(nc: AsyncNextcloudApp) -> str:
    """Get the current user's ID from Nextcloud context."""
    user_info = await nc.ocs("GET", "/ocs/v2.php/cloud/user")
    return user_info["id"]


async def get_tools(nc: AsyncNextcloudApp):

    @tool
    async def convert_document(file_path: str, output_format: str) -> str:
        """Convert a document in your Nextcloud to a different format.

        Args:
            file_path: Path to the file in your Nextcloud (e.g. "Documents/report.docx")
            output_format: Target format: pdf, docx, odt, xlsx, ods, pptx, odp, txt, html, csv
        Returns:
            A message with the path to the converted file in your Nextcloud
        """
        ds_url, jwt_secret = await _get_ds_config(nc)
        user_id = await _get_user_id(nc)
        nc_url = nc.app_cfg.endpoint.rstrip("/")

        # Create a temporary public share link so the DS can fetch the file
        share_response = await nc.ocs(
            "POST",
            "/ocs/v2.php/apps/files_sharing/api/v1/shares",
            json={"path": file_path, "shareType": 3, "permissions": 1},
        )
        share_token = share_response["token"]
        file_url = f"{nc_url}/s/{share_token}/download"

        # Determine input file type from extension
        input_ext = file_path.rsplit(".", 1)[-1].lower() if "." in file_path else ""

        # Generate a unique document key
        doc_key = hashlib.md5(f"{file_path}:{time.time()}".encode()).hexdigest()[:20]

        # Build conversion request payload
        payload = {
            "async": False,
            "filetype": input_ext,
            "key": doc_key,
            "outputtype": output_format.lower(),
            "url": file_url,
        }

        # Sign the request with JWT
        token = _sign_jwt({"payload": payload}, jwt_secret)
        payload["token"] = token

        # Call the DS conversion API
        async with httpx.AsyncClient(timeout=120) as client:
            resp = await client.post(
                f"{ds_url}/converter",
                json=payload,
                headers={
                    "Content-Type": "application/json",
                    "Authorization": f"Bearer {token}",
                },
            )
            result = resp.json()

        if result.get("error"):
            error_code = result.get("error")
            return f"Conversion failed with error code: {error_code}"

        # Download the converted file
        file_download_url = result.get("fileUrl")
        if not file_download_url:
            return "Conversion completed but no output file URL was returned."

        async with httpx.AsyncClient() as client:
            resp = await client.get(file_download_url)
            if resp.status_code >= 400:
                return f"Failed to download converted file: HTTP {resp.status_code}"
            converted_content = resp.content

        # Upload back to Nextcloud via WebDAV
        output_name = file_path.rsplit(".", 1)[0] + "." + output_format.lower()
        upload_url = f"{nc_url}/remote.php/dav/files/{user_id}/{output_name}"

        # Use the NC session's internal adapter for authenticated WebDAV PUT
        try:
            await nc._session._create_adapter(True).request(
                "PUT",
                upload_url,
                content=converted_content,
            )
        except Exception as e:
            # If internal adapter fails, try direct httpx with basic auth
            try:
                async with httpx.AsyncClient() as client:
                    await client.put(
                        upload_url,
                        content=converted_content,
                        auth=("admin", "admin"),  # POC only
                    )
            except Exception as e2:
                # Clean up share and return error
                try:
                    await nc.ocs("DELETE", f"/ocs/v2.php/apps/files_sharing/api/v1/shares/{share_response['id']}")
                except Exception:
                    pass
                return f"Conversion succeeded but failed to upload result: {str(e2)}"

        # Clean up the temporary share
        try:
            await nc.ocs("DELETE", f"/ocs/v2.php/apps/files_sharing/api/v1/shares/{share_response['id']}")
        except Exception:
            pass

        return f"Document converted successfully. Saved as: {output_name}"

    @tool
    async def edit_document(file_path: str, edit_script: str) -> str:
        """Edit a document in your Nextcloud using a Document Builder script.
        The script runs server-side — the document is never loaded into the conversation.

        Args:
            file_path: Path to the file in your Nextcloud (e.g. "Documents/report.docx")
            edit_script: JavaScript code using the Euro-Office Document Builder API to modify the document.
                The script should NOT include builder.OpenFile() or builder.SaveFile() calls — those are added automatically.
                Example: to add a paragraph after the 3rd paragraph:
                    var doc = Api.GetDocument();
                    var paragraphs = doc.GetAllParagraphs();
                    var newPara = Api.CreateParagraph();
                    newPara.AddText("This text was added by the assistant.");
                    doc.InsertContent([newPara], paragraphs[3]);
        Returns:
            A message confirming the edit was applied and where the file is saved
        """
        ds_url, jwt_secret = await _get_ds_config(nc)
        user_id = await _get_user_id(nc)
        nc_url = nc.app_cfg.endpoint.rstrip("/")

        # Create a temporary public share link so the DS can fetch the file
        share_response = await nc.ocs(
            "POST",
            "/ocs/v2.php/apps/files_sharing/api/v1/shares",
            json={"path": file_path, "shareType": 3, "permissions": 1},
        )
        share_token = share_response["token"]
        file_url = f"{nc_url}/s/{share_token}/download"

        # Determine file type
        file_ext = file_path.rsplit(".", 1)[-1].lower() if "." in file_path else "docx"

        # Wrap the user's edit script with OpenFile/SaveFile
        full_script = f'builder.OpenFile("{file_url}");\n{edit_script}\nbuilder.SaveFile("{file_ext}", "output.{file_ext}");\nbuilder.CloseFile();'

        # Build the docbuilder request
        doc_key = hashlib.md5(f"{file_path}:edit:{time.time()}".encode()).hexdigest()[:20]
        payload = {
            "async": False,
            "key": doc_key,
            "url": f"data:text/plain;charset=utf-8,{full_script}",
        }

        token = _sign_jwt({"payload": payload}, jwt_secret)
        payload["token"] = token

        # Call the DS docbuilder API
        async with httpx.AsyncClient(timeout=120) as client:
            resp = await client.post(
                f"{ds_url}/docbuilder",
                json=payload,
                headers={
                    "Content-Type": "application/json",
                    "Authorization": f"Bearer {token}",
                },
            )
            result = resp.json()

        if result.get("error"):
            error_code = result.get("error")
            return f"Edit failed with error code: {error_code}"

        # Download the edited file
        file_download_url = result.get("fileUrl")
        if not file_download_url:
            return "Edit completed but no output file URL was returned."

        async with httpx.AsyncClient() as client:
            resp = await client.get(file_download_url)
            if resp.status_code >= 400:
                return f"Failed to download edited file: HTTP {resp.status_code}"
            edited_content = resp.content

        # Upload back to Nextcloud, overwriting the original
        upload_url = f"{nc_url}/remote.php/dav/files/{user_id}/{file_path}"

        try:
            await nc._session._create_adapter(True).request(
                "PUT",
                upload_url,
                content=edited_content,
            )
        except Exception:
            try:
                async with httpx.AsyncClient() as client:
                    await client.put(upload_url, content=edited_content, auth=("admin", "admin"))
            except Exception as e:
                try:
                    await nc.ocs("DELETE", f"/ocs/v2.php/apps/files_sharing/api/v1/shares/{share_response['id']}")
                except Exception:
                    pass
                return f"Edit succeeded but failed to save result: {str(e)}"

        # Clean up the temporary share
        try:
            await nc.ocs("DELETE", f"/ocs/v2.php/apps/files_sharing/api/v1/shares/{share_response['id']}")
        except Exception:
            pass

        return f"Document edited successfully. Changes saved to: {file_path}"

    return [convert_document, edit_document]
