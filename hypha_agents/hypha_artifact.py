"""
HyphaArtifact module implements an fsspec-compatible interface for Hypha artifacts.

This module provides a file-system like interface to interact with remote Hypha artifacts
using the fsspec specification, allowing for operations like reading, writing, listing,
and manipulating files stored in Hypha artifacts.
"""

import io
import locale
import os
import json
import asyncio
from typing import Literal, Self, overload
import jwt
from dotenv import load_dotenv
import requests
from hypha_rpc import connect_to_server

type OnError = Literal["raise", "ignore"]
type JsonType = str | int | float | bool | None | dict[str, "JsonType"] | list[
    "JsonType"
]
type FileMode = Literal["r", "rb", "w", "wb", "a", "ab"]


def ws_from_token(token: str) -> str:
    """Extracts the workspace ID from the token."""
    decoded_token = jwt.decode(token, options={"verify_signature": False})
    scope = decoded_token.get("scope", "")
    workspace_parts = [part for part in scope.split() if part.startswith("ws:")]
    return workspace_parts[0].split(":", 1)[1].split("#", 1)[0]


def remove_none(d: dict) -> dict:
    """Remove None values from a dictionary."""
    return {k: v for k, v in d.items() if v is not None}


def clean_url(url: str | bytes) -> str:
    """Clean the URL by removing surrounding quotes and converting to string if needed."""
    if isinstance(url, bytes):
        url = url.decode("utf-8")
    return url.strip("\"'")


def parent_and_filename(path: str) -> str | None:
    """Get the parent directory of a path"""
    parts = path.rstrip("/").split("/")
    if len(parts) == 1:
        return None, parts[-1]  # Root directory
    return "/".join(parts[:-1]), parts[-1]


class ArtifactHttpFile(io.IOBase):
    """A file-like object that supports both sync and async context manager protocols.

    This implements a file interface for Hypha artifacts, handling HTTP operations
    via the requests library instead of relying on Pyodide.
    """

    def __init__(
        self: Self,
        url: str,
        mode: FileMode = "r",
        encoding: str | None = None,
        newline: str | None = None,
        name: str | None = None,
    ) -> None:
        self._url = url
        self._pos = 0
        self._mode = mode
        self._encoding = encoding or locale.getpreferredencoding()
        self._newline = newline or os.linesep
        self.name = name
        self._closed = False
        self._buffer = io.BytesIO()

        if "r" in mode:
            # For read mode, download the content immediately
            self._download_content()
            self._size = len(self._buffer.getvalue())
        else:
            # For write modes, initialize an empty buffer
            self._size = 0

    def _download_content(self: Self, range_header: str = None) -> None:
        """Download content from URL into buffer, optionally using a range header."""
        try:
            # Clean the URL by removing any surrounding quotes and converting to string if needed
            cleaned_url = clean_url(self._url)

            headers = {}
            if range_header:
                headers["Range"] = range_header

            response = requests.get(cleaned_url, headers=headers, timeout=60)
            response.raise_for_status()
            self._buffer = io.BytesIO(response.content)
        except requests.exceptions.RequestException as e:
            # More detailed error information for debugging
            status_code = (
                e.response.status_code if hasattr(e, "response") else "unknown"
            )
            message = str(e)
            raise IOError(
                f"Error downloading content (status {status_code}): {message}"
            ) from e
        except Exception as e:
            raise IOError(f"Unexpected error downloading content: {str(e)}") from e

    def _upload_content(self: Self) -> requests.Response:
        """Upload buffer content to URL"""
        try:
            content = self._buffer.getvalue()

            cleaned_url = clean_url(self._url)

            headers = {
                "Content-Type": "application/octet-stream",
                "Content-Length": str(len(content)),
            }

            response = requests.put(
                cleaned_url, data=content, headers=headers, timeout=60
            )

            response.raise_for_status()
            return response
        except requests.exceptions.HTTPError as e:
            status_code = (
                e.response.status_code if hasattr(e, "response") else "unknown"
            )
            error_msg = e.response.text if hasattr(e, "response") else str(e)
            raise IOError(
                f"HTTP error uploading content (status {status_code}): {error_msg}"
            ) from e
        except Exception as e:
            raise IOError(f"Error uploading content: {str(e)}") from e

    def tell(self: Self) -> int:
        """Return current position in the file"""
        return self._pos

    def seek(self: Self, offset: int, whence: int = 0) -> int:
        """Change stream position"""
        if whence == 0:  # os.SEEK_SET
            self._pos = offset
        elif whence == 1:  # os.SEEK_CUR
            self._pos += offset
        elif whence == 2:  # os.SEEK_END
            self._pos = self._size + offset

        # Make sure buffer's position is synced
        self._buffer.seek(self._pos)
        return self._pos

    def read(self: Self, size: int = -1) -> bytes:
        """Read up to size bytes from the file, using HTTP range if necessary."""
        if "r" not in self._mode:
            raise IOError("File not open for reading")

        if size < 0:
            self._download_content()
        else:
            range_header = f"bytes={self._pos}-{self._pos + size - 1}"
            self._download_content(range_header=range_header)

        data = self._buffer.read()
        self._pos += len(data)

        if "b" not in self._mode:
            return data.decode(self._encoding)
        return data

    def write(self: Self, data: str | bytes) -> int:
        """Write data to the file"""
        if "w" not in self._mode and "a" not in self._mode:
            raise IOError("File not open for writing")

        # Convert string to bytes if necessary
        if isinstance(data, str) and "b" in self._mode:
            data = data.encode(self._encoding)
        elif isinstance(data, bytes) and "b" not in self._mode:
            data = data.decode(self._encoding)
            data = data.encode(self._encoding)

        # Ensure we're at the right position
        self._buffer.seek(self._pos)

        # Write the data
        if isinstance(data, str):
            bytes_written = self._buffer.write(data.encode(self._encoding))
        else:
            bytes_written = self._buffer.write(data)

        self._pos = self._buffer.tell()
        if self._pos > self._size:
            self._size = self._pos

        return bytes_written

    def readable(self: Self) -> bool:
        """Return whether the file is readable"""
        return "r" in self._mode

    def writable(self: Self) -> bool:
        """Return whether the file is writable"""
        return "w" in self._mode or "a" in self._mode

    def seekable(self: Self) -> bool:
        """Return whether the file is seekable"""
        return True

    def close(self: Self) -> None:
        """Close the file and upload content if in write mode"""
        if self._closed:
            return

        try:
            if "w" in self._mode or "a" in self._mode:
                self._upload_content()
        finally:
            self._closed = True
            self._buffer.close()

    def __enter__(self: Self) -> Self:
        """Enter context manager"""
        return self

    def __exit__(self: Self, exc_type, exc_val, exc_tb) -> None:
        """Exit context manager"""
        self.close()

    def __aenter__(self: Self) -> Self:
        """Enter async context manager"""
        return self

    def __aexit__(self: Self, exc_type, exc_val, exc_tb) -> None:
        """Exit async context manager"""
        self.close()


class HyphaArtifact:
    artifact_alias: str
    artifact_url: str
    token: str
    workspace_id: str

    def __init__(self: Self, artifact_alias: str):
        """Initialize a HyphaArtifact instance.

        Parameters
        ----------
        artifact_id: str
            The identifier of the Hypha artifact to interact with
        """
        load_dotenv()
        self.artifact_alias = artifact_alias
        self.token = os.getenv("PERSONAL_TOKEN")
        self.workspace_id = ws_from_token(self.token)
        self.artifact_url = "https://hypha.aicell.io/public/services/artifact-manager"

    def _extend_params(
        self: Self,
        params: dict[str, JsonType],
    ) -> dict[str, JsonType]:
        params["artifact_id"] = self.artifact_alias

        return params

    def _remote_post(self: Self, method_name: str, params: dict[str, JsonType]) -> str:
        """Make a POST request to the artifact service with extended parameters.

        Returns:
            For put_file requests, returns the pre-signed URL as a string.
            For other requests, returns the response content.
        """
        extended_params = self._extend_params(params)
        cleaned_params = remove_none(extended_params)

        request_url = f"{self.artifact_url}/{method_name}"

        response = requests.post(
            request_url,
            json=cleaned_params,  # Send as JSON in request body
            headers={"Authorization": f"Bearer {self.token}"},
            timeout=60,  # Increased timeout
        )

        response.raise_for_status()

        return response.content

    def _remote_get(self: Self, method_name: str, params: dict[str, JsonType]) -> None:
        extended_params = self._extend_params(params)
        if extended_params.get("version") is None:
            extended_params["version"] = "stage"
        cleaned_params = remove_none(extended_params)

        response = requests.get(
            f"{self.artifact_url}/{method_name}",
            params=cleaned_params,
            headers={"Authorization": f"Bearer {self.token}"},
            timeout=20,
        )

        response.raise_for_status()
        return response.content

    def _remote_edit(
        self: Self,
        manifest: dict | None = None,
        artifact_type: str | None = None,
        permissions: dict | None = None,
        config: dict | None = None,
        secrets: dict | None = None,
        version: str | None = None,
        comment: str | None = None,
        copy_files: bool | None = None,
    ) -> None:
        """Edits the artifact's metadata, including the manifest, type, and permissions.

        Args:
            self (Self): The instance of the HyphaArtifact class.
            manifest (dict | None): Optional. The updated manifest.
                Ensure the manifest follows the required schema
                if applicable (e.g., for collections).
            artifact_type (str | None): Optional. The type of the artifact.
                Supported values are collection, generic and any other custom type.
                By default, it's set to generic which contains fields tailored for
                displaying the artifact as cards on a webpage.
            permissions (dict | None): Optional. A dictionary containing user permissions.
                For example {"*": "r+"} gives read and create access to everyone,
                {"@": "rw+"} allows all authenticated users to read/write/create,
                and {"user_id_1": "r+"} grants read and create permissions to a specific user.
                You can also set permissions for specific operations,
                such as {"user_id_1": ["read", "create"]}.
                See detailed explanation about permissions below.
            secrets (dict | None): Optional. A dictionary containing secrets to be stored
                with the artifact. Secrets are encrypted and can only be accessed
                by the artifact owner or users with appropriate permissions.
                See the create function for a list of supported secrets.
            config (dict | None): Optional. Optional. A dictionary containing additional
                configuration options for the artifact.
            version (str | None): Optional. Optional. The version of the artifact to edit.
                By default, it set to None, the version will stay the same.
                If you want to create a staged version, you can set it to "stage".
                You can set it to any version in text, e.g. 0.1.0 or v1.
                If you set it to "new", it will generate a version similar to v0, v1, etc.
            comment (str | None): Optional. A comment to describe the changes made to the artifact.
            copy_files (bool | None): Optional. A boolean flag indicating whether to copy files
                from the previous version when creating a new staged version.
                Default is None. Set to True to copy files from the previous version.
        """

        params = {
            "manifest": manifest,
            "artifact_type": artifact_type,
            "permissions": permissions,
            "config": config,
            "secrets": secrets,
            "version": version,
            "comment": comment,
            "copy_files": copy_files,
        }
        self._remote_post("edit", params)

    def _remote_put_file_url(
        self: Self,
        file_path: str,
        download_weight: float | None = None,
    ) -> str:
        """Generates a pre-signed URL to upload a file to the artifact in S3. The URL can be used
        with an HTTP PUT request to upload the file.

        Args:
            self (Self): The instance of the HyphaArtifact class.
            file_path (str): The relative path of the file to upload within the
                artifact (e.g., "data.csv").
            download_weight (float | None): A float value representing the file's impact
                on download count (0-1). Defaults to None.

        Returns:
            str: A pre-signed URL for uploading the file.
        """
        params = {
            "file_path": file_path,
        }
        # Only include download_weight if it's not None
        if download_weight is not None:
            params["download_weight"] = download_weight

        response = self._remote_post("put_file", params)
        return response

    def _remote_remove_file(
        self: Self,
        file_path: str,
    ) -> None:
        """Removes a file from the artifact and updates the staged manifest. The file is
        also removed from the S3 storage.

        Args:
            self (Self): The instance of the HyphaArtifact class.
            file_path (str): The relative path of the file to be removed (e.g., "data.csv").
        """
        params = {
            "file_path": file_path,
        }
        self._remote_post("remove_file", params)

    def _remote_get_file_url(self: Self, file_path: str, silent: bool = False) -> str:
        """Generates a pre-signed URL to download a file from the artifact stored in S3.

        Args:
            self (Self): The instance of the HyphaArtifact class.
            file_path (str): The relative path of the file to be downloaded (e.g., "data.csv").
            silent (bool, optional): A boolean to suppress the download count increment.
                Default is False.

        Returns:
            str: A pre-signed URL for downloading the file.
        """
        params = {
            "file_path": file_path,
            "silent": silent,
        }
        return self._remote_get("get_file", params)

    def _remote_list_contents(
        self: Self, dir_path: str | None = None
    ) -> list[JsonType]:
        """Lists all files in the artifact.

        Args:
            self (Self): The instance of the HyphaArtifact class.
            dir_path (str | None, optional): Optional. The directory path within the artifact to
                list files from. Default is None.

        Returns:
            list[JsonType]: A list of files in the specified directory.
        """
        params = {
            "dir_path": dir_path,
        }
        response_bytes = self._remote_get("list_files", params)

        return json.loads(response_bytes.decode("utf-8"))

    @overload
    def cat(
        self: Self,
        path: list[str],
        recursive: bool = False,
        on_error: OnError | None = None,
    ) -> dict[str, str]: ...

    @overload
    def cat(
        self: Self, path: str, recursive: bool = False, on_error: OnError | None = None
    ) -> str: ...

    def cat(
        self: Self,
        path: str | list[str],
        recursive: bool = False,
        on_error: OnError = "raise",
    ) -> dict[str, str] | str:
        """Get file(s) content as string(s)

        Parameters
        ----------
        path: str or list of str
            File path(s) to get content from
        recursive: bool
            If True and path is a directory, get all files content
        on_error: "raise" or "ignore"
            What to do if a file is not found

        Returns
        -------
        str or dict
            File contents as string if path is a string, or dict of {path: content} if path is a list
        """
        # Handle the case where path is a list of paths
        if isinstance(path, list):
            result = {}
            for p in path:
                try:
                    result[p] = self.cat(p, recursive=recursive, on_error=on_error)
                except Exception:
                    if on_error == "raise":
                        raise
            return result

        # Handle recursive case
        if recursive and self.isdir(path):
            files = self.find(path, maxdepth=None)
            return {p: self.cat(p, on_error=on_error) for p in files}

        # Handle single file case
        try:
            with self.open(path, mode="r") as file:
                return file.read()
        except Exception:
            if on_error == "raise":
                raise
            return None

    def open(
        self: Self,
        urlpath: str,
        mode: FileMode = "rb",
        **kwargs,
    ) -> ArtifactHttpFile:
        """Open a file for reading or writing

        Parameters
        ----------
        urlpath: str
            Path to the file within the artifact
        mode: FileMode
            File mode, one of 'r', 'rb', 'w', 'wb', 'a', 'ab'

        Returns
        -------
        WithHTTPFile
            A file-like object
        """
        normalized_path = urlpath[1:] if urlpath.startswith("/") else urlpath

        if "r" in mode:
            download_url = self._remote_get_file_url(normalized_path)
            return ArtifactHttpFile(
                url=download_url,
                mode=mode,
                name=normalized_path,
                **kwargs,
            )
        elif "w" in mode or "a" in mode:
            self._remote_edit(version="stage")
            upload_url = self._remote_put_file_url(normalized_path)
            file_obj = ArtifactHttpFile(
                url=upload_url,
                mode=mode,
                name=normalized_path,
                **kwargs,
            )

            return file_obj
        else:
            raise ValueError(f"Unsupported file mode: {mode}")

    def copy(
        self: Self,
        path1: str,
        path2: str,
        recursive: bool = False,
        maxdepth: int | None = None,
        on_error: OnError = "raise",
        **kwargs,
    ) -> None:
        """Copy file(s) from path1 to path2 within the artifact

        Parameters
        ----------
        path1: str
            Source path
        path2: str
            Destination path
        recursive: bool
            If True and path1 is a directory, copy all its contents recursively
        maxdepth: int or None
            Maximum recursion depth when recursive=True
        on_error: "raise" or "ignore"
            What to do if a file is not found
        """
        # Stage the artifact for edits
        self._remote_edit(version="stage")
        # Handle recursive case
        if recursive and self.isdir(path1):
            files = self.find(path1, maxdepth=maxdepth)
            for file_path in files:
                # Calculate the destination path
                rel_path = file_path[len(path1) :].lstrip("/")
                dest_path = f"{path2}/{rel_path}" if path2 else rel_path
                try:
                    self._copy_single_file(file_path, dest_path)
                except Exception:
                    if on_error == "raise":
                        raise
        else:
            # Copy a single file
            self._copy_single_file(path1, path2)

    def _copy_single_file(self, src: str, dst: str) -> None:
        """Helper method to copy a single file"""
        content = self.cat(src)
        with self.open(dst, mode="w") as f:
            f.write(content)

    def cp(
        self: Self, path1: str, path2: str, on_error: OnError | None = None, **kwargs
    ) -> None:
        """Alias for copy method

        Parameters
        ----------
        path1: str
            Source path
        path2: str
            Destination path
        on_error: "raise" or "ignore", optional
            What to do if a file is not found
        **kwargs:
            Additional arguments passed to copy method

        Returns
        -------
        None
        """
        return self.copy(path1, path2, on_error=on_error, **kwargs)

    def rm(
        self: Self, path: str, recursive: bool = False, maxdepth: int | None = None
    ) -> None:
        """Remove a file from the artifact

        Parameters
        ----------
        path: str
            Path to the file to remove
        recursive: bool, optional
            Not used, included for fsspec compatibility
        maxdepth: int or None, optional
            Not used, included for fsspec compatibility

        Returns
        -------
        None
        """
        self._remote_edit(version="stage")
        self._remote_remove_file(path)

    def created(self: Self, path: str):
        """Get the creation time of a file

        In the Hypha artifact system, we might not have direct access to creation time,
        but we can retrieve this information from file metadata if available.

        Parameters
        ----------
        path: str
            Path to the file

        Returns
        -------
        datetime or None
            Creation time of the file, if available
        """
        info = self.info(path)
        # Return creation time if available in the metadata, otherwise None
        return info.get("created") if info else None

    def delete(
        self: Self, path: str, recursive: bool = False, maxdepth: int | None = None
    ):
        return self.rm(path, recursive, maxdepth)

    def exists(self: Self, path: str, **kwargs) -> bool:
        """Check if a file or directory exists

        Parameters
        ----------
        path: str
            Path to check

        Returns
        -------
        bool
            True if the path exists, False otherwise
        """
        try:
            self.info(path)
            return True
        except Exception:
            return False

    def ls(self: Self, path: str, detail: bool = True, **kwargs) -> list[str | dict]:
        """List files and directories in a directory

        Parameters
        ----------
        path: str
            Path to list
        detail: bool
            If True, return a list of dictionaries with file details
            If False, return a list of file paths

        Returns
        -------
        list
            List of files and directories in the directory
        """
        result = self._remote_list_contents(path)

        if not detail:
            return [item["name"] for item in result]

        return result

    def info(self: Self, path: str, **kwargs) -> dict[str, str | int]:
        """Get information about a file or directory

        Parameters
        ----------
        path: str
            Path to get information about

        Returns
        -------
        dict
            Dictionary with file information
        """
        parent_path, filename = parent_and_filename(path)

        listing = self.ls(parent_path)
        for item in listing:
            if item["name"] == filename:
                # It's a file
                return item

        raise FileNotFoundError(f"Path not found: {path}")

    def isdir(self: Self, path: str) -> bool:
        """Check if a path is a directory

        Parameters
        ----------
        path: str
            Path to check

        Returns
        -------
        bool
            True if the path is a directory, False otherwise
        """
        try:
            info = self.info(path)
            return info["type"] == "directory"
        except Exception:
            return False

    def isfile(self: Self, path: str) -> bool:
        """Check if a path is a file

        Parameters
        ----------
        path: str
            Path to check

        Returns
        -------
        bool
            True if the path is a file, False otherwise
        """
        try:
            info = self.info(path)
            return info["type"] == "file"
        except Exception:
            return False

    def listdir(self: Self, path: str, **kwargs) -> list[str]:
        return self.ls(path, **kwargs)

    def find(
        self: Self,
        path: str,
        maxdepth: int | None = None,
        withdirs: bool = False,
        detail: bool = False,
        **kwargs,
    ) -> list[str] | dict[str, dict]:
        """Find all files (and optional directories) under a path

        Parameters
        ----------
        path: str
            Base path to search from
        maxdepth: int or None
            Maximum recursion depth when searching
        withdirs: bool
            Whether to include directories in the results
        detail: bool
            If True, return a dict of {path: info_dict}
            If False, return a list of paths

        Returns
        -------
        list or dict
            List of paths or dict of {path: info_dict}
        """

        # Helper function to walk the directory tree recursively
        def _walk_dir(current_path, current_depth):
            results = {}

            # List current directory
            try:
                items = self.ls(current_path)
            except Exception:
                return {}

            # Add items to results
            for item in items:
                item_type = item.get("type")
                item_name = item.get("name")

                if item_type == "file" or (withdirs and item_type == "directory"):
                    results[item_name] = item

                # Recurse into subdirectories if depth allows
                if item_type == "directory" and (
                    maxdepth is None or current_depth < maxdepth
                ):
                    subdirectory_results = _walk_dir(item_name, current_depth + 1)
                    results.update(subdirectory_results)

            return results

        # Start the recursive walk
        all_files = _walk_dir(path, 1)

        if detail:
            return all_files
        else:
            return sorted(all_files.keys())

    def mkdir(self: Self, path: str, create_parents: bool = True, **kwargs) -> None:
        """Create a directory

        In the Hypha artifact system, directories don't need to be explicitly created,
        they are implicitly created when files are added under a path.
        However, we'll implement this as a no-op to maintain compatibility.

        Parameters
        ----------
        path: str
            Path to create
        create_parents: bool
            If True, create parent directories if they don't exist
        """
        # Directories in Hypha artifacts are implicit
        # This is a no-op for compatibility with fsspec

    def makedirs(self: Self, path: str, exist_ok: bool = True, **kwargs) -> None:
        """Create a directory and any parent directories

        In the Hypha artifact system, directories don't need to be explicitly created,
        they are implicitly created when files are added under a path.
        However, we'll implement this as a no-op to maintain compatibility.

        Parameters
        ----------
        path: str
            Path to create
        exist_ok: bool
            If False and the directory exists, raise an error
        """
        # If the directory already exists and exist_ok is False, raise an error
        if not exist_ok and self.exists(path) and self.isdir(path):
            raise FileExistsError(f"Directory already exists: {path}")

    def rm_file(self: Self, path: str) -> None:
        """Remove a file

        Parameters
        ----------
        path: str
            Path to remove
        """
        self.rm(path)

    def rmdir(self: Self, path: str) -> None:
        """Remove an empty directory

        In the Hypha artifact system, directories are implicit, so this would
        only make sense if the directory is empty. Since empty directories
        don't really exist explicitly, this is essentially a validation check
        that no files exist under this path.

        Parameters
        ----------
        path: str
            Path to remove
        """
        # Check if the directory exists
        if not self.isdir(path):
            raise FileNotFoundError(f"Directory not found: {path}")

        # Check if the directory is empty
        files = self.ls(path)
        if files:
            raise OSError(f"Directory not empty: {path}")

        # If we get here, the directory is empty (or doesn't exist),
        # so there's nothing to do

    def head(self: Self, path: str, size: int = 1024) -> bytes:
        """Get the first bytes of a file

        Parameters
        ----------
        path: str
            Path to the file
        size: int
            Number of bytes to read

        Returns
        -------
        bytes
            First bytes of the file
        """
        with self.open(path, mode="rb") as f:
            return f.read(size)

    def size(self: Self, path: str) -> int:
        """Get the size of a file in bytes

        Parameters
        ----------
        path: str
            Path to the file

        Returns
        -------
        int
            Size of the file in bytes
        """
        info = self.info(path)
        if info["type"] == "directory":
            return 0
        return info.get("size", 0) or 0  # Default to 0 if size is None

    def sizes(self: Self, paths: list[str]) -> list[int]:
        """Get the size of multiple files

        Parameters
        ----------
        paths: list of str
            Paths to the files

        Returns
        -------
        list of int
            Sizes of the files in bytes
        """
        return [self.size(path) for path in paths]


async def create_artifact(artifact_id: str, token: str, server_url: str) -> bool:
    """Create a new artifact in Hypha.

    Parameters
    ----------
    artifact_id: str
        The identifier for the new artifact
    token: str
        Authorization token for Hypha
     server_url: str
        The base URL of the Hypha server

    Returns
    -------
    bool
        True if artifact was created successfully, False otherwise
    """
    try:
        # Connect to the Hypha server
        api = await connect_to_server(
            {
                "name": "artifact-client",
                "server_url": "https://hypha.aicell.io",
                "token": token,
            }
        )

        # Get the artifact manager service
        artifact_manager = await api.get_service("public/artifact-manager")

        # Create the artifact
        manifest = {
            "name": artifact_id,
            "description": f"Artifact created programmatically: {artifact_id}",
        }

        await artifact_manager.create(
            alias=artifact_id,
            type="generic",
            manifest=manifest,
            config={"permissions": {"*": "rw+", "@": "rw+"}},
        )

        # Disconnect from the server
        await api.disconnect()
        return True

    except Exception:
        return False


def create_artifact_sync(artifact_id: str, token: str, server_url: str) -> bool:
    """Synchronous wrapper for create_artifact function"""
    loop = asyncio.new_event_loop()
    try:
        return loop.run_until_complete(create_artifact(artifact_id, token, server_url))
    finally:
        loop.close()
