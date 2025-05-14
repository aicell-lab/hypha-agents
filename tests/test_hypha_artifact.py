"""
Integration tests for the HyphaArtifact module.

This module contains integration tests for the HyphaArtifact class,
testing real file operations such as creation, reading, copying, and deletion
against an actual Hypha artifact service.
"""

import os
import uuid
import pytest
import asyncio
from dotenv import load_dotenv
from hypha_agents.hypha_artifact import HyphaArtifact
from hypha_rpc import connect_to_server

# Load environment variables from .env file
load_dotenv()

# Skip all tests if no token is available
pytestmark = pytest.mark.skipif(
    os.getenv("PERSONAL_TOKEN") is None,
    reason="PERSONAL_TOKEN environment variable not set",
)


@pytest.fixture(scope="module")
def artifact_name():
    """Generate a unique artifact name for testing."""
    return f"test_artifact_{uuid.uuid4().hex[:8]}"


async def create_artifact(artifact_id: str, token: str):
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


def create_artifact_sync(artifact_id: str, token: str) -> bool:
    """Synchronous wrapper for create_artifact function"""
    loop = asyncio.new_event_loop()
    try:
        return loop.run_until_complete(create_artifact(artifact_id, token))
    finally:
        loop.close()


@pytest.fixture(scope="module")
def artifact(artifact_name):
    """Create a test artifact with a real connection to Hypha."""

    create_artifact_sync(artifact_name, os.getenv("PERSONAL_TOKEN"))
    _artifact = HyphaArtifact(artifact_name)
    print(f"Created test artifact: {artifact_name}")
    return _artifact


@pytest.fixture
def test_content():
    """Provide test file content for testing."""
    return "This is a test file content for integration testing"


class TestHyphaArtifactIntegration:
    """Integration test suite for the HyphaArtifact class."""

    def test_artifact_initialization(self, artifact, artifact_name):
        """Test that the artifact is initialized correctly with real credentials."""
        assert artifact.artifact_alias == artifact_name
        assert artifact.token is not None
        assert artifact.workspace_id is not None
        assert artifact.artifact_url is not None

    def test_create_file(self, artifact, test_content):
        """Test creating a file in the artifact using real operations."""
        test_file_path = "test_file.txt"

        # Create a test file
        with artifact.open(test_file_path, "w") as f:
            f.write(test_content)

        # Verify the file was created
        files = artifact.ls("/")
        file_names = [f.get("name") for f in files]
        assert (
            test_file_path in file_names
        ), f"Created file {test_file_path} not found in {file_names}"

    def test_list_files(self, artifact):
        """Test listing files in the artifact using real operations."""
        # First, list files with detail=True (default)
        files = artifact.ls("/")

        # Verify we got a list with file details
        assert isinstance(files, list)
        if files:
            assert "name" in files[0], "File listing should include 'name' attribute"
            assert "size" in files[0], "File listing should include 'size' attribute"

        # Test listing with detail=False
        file_names = artifact.ls("/", detail=False)
        assert isinstance(file_names, list)
        if files:
            # Check that file_names contains string values, not dictionaries
            assert all(
                isinstance(name, str) for name in file_names
            ), "File names should be strings"

    def test_read_file_content(self, artifact, test_content):
        """Test reading content from a file in the artifact using real operations."""
        test_file_path = "test_file.txt"

        # Ensure the test file exists (create if needed)
        if not artifact.exists(test_file_path):
            with artifact.open(test_file_path, "w") as f:
                f.write(test_content)

        # Read the file content
        content = artifact.cat(test_file_path)

        # Verify the content matches
        assert (
            content == test_content
        ), f"File content doesn't match. Expected: '{test_content}', Got: '{content}'"

    def test_copy_file(self, artifact, test_content):
        """Test copying a file within the artifact using real operations."""
        source_path = "source_file.txt"
        copy_path = "copy_of_source_file.txt"

        # Create a source file if it doesn't exist
        if not artifact.exists(source_path):
            with artifact.open(source_path, "w") as f:
                f.write(test_content)

        # Copy the file
        artifact.copy(source_path, copy_path)

        # Verify both files exist
        assert artifact.exists(source_path), f"Source file {source_path} should exist"
        assert artifact.exists(copy_path), f"Copied file {copy_path} should exist"

        # Verify content is the same
        source_content = artifact.cat(source_path)
        copy_content = artifact.cat(copy_path)
        assert (
            source_content == copy_content
        ), "Content in source and copied file should match"

    def test_file_existence(self, artifact):
        """Test checking if files exist in the artifact using real operations."""
        # Create a test file to check existence
        test_file_path = "existence_test.txt"
        with artifact.open(test_file_path, "w") as f:
            f.write("Testing file existence")

        # Test for existing file
        assert (
            artifact.exists(test_file_path) is True
        ), f"File {test_file_path} should exist"

        # Test for non-existent file
        non_existent_path = "this_file_does_not_exist.txt"
        assert (
            artifact.exists(non_existent_path) is False
        ), f"File {non_existent_path} should not exist"

    def test_remove_file(self, artifact):
        """Test removing a file from the artifact using real operations."""
        # Create a file to be removed
        removal_test_file = "file_to_remove.txt"

        # Ensure the file exists first
        with artifact.open(removal_test_file, "w") as f:
            f.write("This file will be removed")

        # Verify file exists before removal
        assert artifact.exists(
            removal_test_file
        ), f"File {removal_test_file} should exist before removal"

        # Remove the file
        artifact.rm(removal_test_file)

        # Verify file no longer exists
        assert not artifact.exists(
            removal_test_file
        ), f"File {removal_test_file} should no longer exist after removal"

    def test_workflow(self, artifact, test_content):
        """Integration test for a complete file workflow: create, read, copy, remove."""
        # File paths for testing
        original_file = "workflow_test.txt"
        copied_file = "workflow_test_copy.txt"

        # Step 1: Create file
        with artifact.open(original_file, "w") as f:
            f.write(test_content)

        # Step 2: Verify file exists and content is correct
        assert artifact.exists(original_file)
        content = artifact.cat(original_file)
        assert content == test_content

        # Step 3: Copy file
        artifact.copy(original_file, copied_file)
        assert artifact.exists(copied_file)

        # Step 4: Remove copied file
        artifact.rm(copied_file)
        assert not artifact.exists(copied_file)
        assert artifact.exists(original_file)

    def test_partial_file_read(self, artifact, test_content):
        """Test reading only part of a file using the size parameter in read."""
        test_file_path = "partial_read_test.txt"

        # Create a test file
        with artifact.open(test_file_path, "w") as f:
            f.write(test_content)

        # Read only the first 10 bytes of the file
        with artifact.open(test_file_path, "r") as f:
            partial_content = f.read(10)

        # Verify the partial content matches the expected first 10 bytes
        expected_content = test_content[:10]
        assert (
            partial_content == expected_content
        ), f"Partial content doesn't match. Expected: '{expected_content}', Got: '{partial_content}'"


if __name__ == "__main__":
    # For manual test runs
    load_dotenv()
    token = os.getenv("PERSONAL_TOKEN")

    if not token:
        print(
            "WARNING: No PERSONAL_TOKEN found. Tests requiring real connections will fail."
        )
        print(
            "Please create a .env file with your PERSONAL_TOKEN for integration testing."
        )
