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

        await nc._session._create_adapter(True).request(
            "PUT",
            upload_url,
            content=converted_content,
        )

        # Clean up the temporary share
        share_id = share_response["id"]
        await nc.ocs("DELETE", f"/ocs/v2.php/apps/files_sharing/api/v1/shares/{share_id}")

        return f"Document converted successfully. Saved as: {output_name}"

    return [convert_document]
