# HyphaArtifact Documentation

`HyphaArtifact` is an fsspec-compatible interface for Hypha artifacts that provides a file-system like interface to interact with remote Hypha artifacts. This allows for operations such as reading, writing, listing, and manipulating files stored in Hypha artifacts.

## Overview

The `HyphaArtifact` class provides a file-system-like interface that follows the fsspec specification, making it easy to interact with Hypha artifacts in a familiar way. It supports various file operations including:

- Creating and reading files
- Listing directory contents
- Copying files between locations
- Removing files
- Checking file existence and properties
- Partial file reading with HTTP Range headers

## Installation

```bash
# Install from the repository
pip install git+https://github.com/your-repo/hypha-startup-services.git

# Or for development
git clone https://github.com/your-repo/hypha-startup-services.git
cd hypha-startup-services
pip install -e .
```

## Authentication

The `HyphaArtifact` class requires a personal access token for authentication. This token can be provided in a `.env` file in your project directory:

```
PERSONAL_TOKEN=your_hypha_personal_token
```

## Basic Usage

### Initialization

```python
from hypha_startup_services.hypha_artifact import HyphaArtifact

# Initialize with an artifact alias
artifact = HyphaArtifact("example_artifact")
```

### File Operations

#### Creating a File

```python
# Open a file for writing
with artifact.open("path/to/file.txt", "w") as f:
    f.write("This is a test file")
```

#### Reading a File

```python
# Read the entire file
content = artifact.cat("path/to/file.txt")
print(content)

# Open a file for reading
with artifact.open("path/to/file.txt", "r") as f:
    content = f.read()
    print(content)
```

#### Reading a Partial File with HTTP Range

One of the key features of `HyphaArtifact` is the ability to read only part of a file using HTTP Range headers, which is more efficient than downloading the entire file:

```python
# Read only the first 10 bytes of a file
with artifact.open("path/to/large_file.txt", "r") as f:
    partial_content = f.read(10)
    print(partial_content)
```

#### Copying a File

```python
# Copy a file within the artifact
artifact.copy("path/to/source.txt", "path/to/destination.txt")

# You can also use the cp alias
artifact.cp("path/to/source.txt", "path/to/destination.txt")
```

#### Checking if a File Exists

```python
# Check if a file exists
exists = artifact.exists("path/to/file.txt")
print(f"File exists: {exists}")
```

#### Listing Files

```python
# List files in a directory
files = artifact.ls("/path/to/dir")
for file in files:
    print(file["name"])

# List only file names without details
file_names = artifact.ls("/path/to/dir", detail=False)
print(file_names)
```

#### Getting File Info

```python
# Get information about a file
info = artifact.info("path/to/file.txt")
print(f"File size: {info['size']} bytes")
print(f"Last modified: {info['last_modified']}")
```

#### Removing a File

```python
# Remove a file
artifact.rm("path/to/file.txt")

# You can also use the delete alias
artifact.delete("path/to/file.txt")
```

#### Creating Directories

```python
# Create a directory
artifact.mkdir("path/to/new/dir")

# Create a directory and parent directories if they don't exist
artifact.makedirs("path/to/nested/dir")
```

### Advanced Operations

#### Finding Files

```python
# Find all files under a path
files = artifact.find("/path/to/dir")
print(files)

# Find files with detailed information
file_details = artifact.find("/path/to/dir", detail=True)
print(file_details)
```

#### Getting First Bytes of a File

```python
# Get the first 100 bytes of a file
head = artifact.head("path/to/file.txt", size=100)
print(head)
```

#### Getting File Size

```python
# Get the size of a file in bytes
size = artifact.size("path/to/file.txt")
print(f"File size: {size} bytes")

# Get sizes of multiple files
sizes = artifact.sizes(["file1.txt", "file2.txt"])
print(sizes)
```

## Error Handling

The `HyphaArtifact` class raises appropriate exceptions when operations fail:

- `FileNotFoundError`: When attempting to access a non-existent file
- `IOError`: For various I/O related errors
- `PermissionError`: For permission-related issues
- `KeyError`: When an artifact doesn't exist

Example error handling:

```python
try:
    content = artifact.cat("non_existent_file.txt")
except FileNotFoundError as e:
    print(f"File not found: {e}")
```

## Working with HTTP Range Headers

The `HyphaArtifact` class implements HTTP Range headers to efficiently fetch portions of files:

```python
# Read only a specific range of bytes
with artifact.open("large_file.txt", "r") as f:
    f.seek(1000)  # Move to position 1000
    data = f.read(500)  # Read 500 bytes starting from position 1000
```

This is particularly useful for large files where you don't need the entire content.

## Full Example

```python
from hypha_startup_services.hypha_artifact import HyphaArtifact
import os
from dotenv import load_dotenv

# Load token from .env file
load_dotenv()

# Initialize artifact object
artifact = HyphaArtifact("example_artifact")

# Create a test file
with artifact.open("test_folder/example_file.txt", "w") as f:
    f.write("This is a test file")

# Check if the file exists
exists = artifact.exists("test_folder/example_file.txt")
print(f"File exists: {exists}")

# List files in the test folder
files = artifact.ls("/test_folder", detail=False)
print("Files in test_folder:", files)

# Read file content
content = artifact.cat("test_folder/example_file.txt")
print(f"File content: {content}")

# Read only partial content
with artifact.open("test_folder/example_file.txt", "r") as f:
    partial = f.read(10)
    print(f"First 10 bytes: {partial}")

# Copy the file
artifact.copy("test_folder/example_file.txt", "test_folder/copy_of_example_file.txt")

# Remove the copied file
artifact.rm("test_folder/copy_of_example_file.txt")
```

## Implementation Details

The `HyphaArtifact` class uses HTTP requests to interact with the Hypha artifact service. Under the hood, it:

1. Uses the `requests` library to make HTTP requests
2. Authenticates using a personal token
3. Extracts workspace information from the token
4. Provides an fsspec-compatible interface for file operations
5. Uses HTTP Range headers for efficient partial file reading

## Best Practices

1. Always close file handles properly by using context managers (`with` statements)
2. Check file existence before operations to avoid errors
3. Use partial file reading with HTTP Range headers for large files
4. Use meaningful directory structures within artifacts
5. Handle errors appropriately in your application

## Advanced Configuration

The `HyphaArtifact` class can be configured with additional options if needed. These include:

- Custom artifact URLs
- Alternative authentication methods
- File encoding options

## Troubleshooting

Common issues and solutions:

1. Authentication failures:
   - Ensure your personal token is correctly set in the .env file
   - Check that the token has the appropriate permissions

2. File not found errors:
   - Verify the file path is correct (case-sensitive)
   - Check if the artifact exists and is accessible

3. Permission issues:
   - Ensure your token has the appropriate permissions for the operations

4. Connection issues:
   - Check your internet connection
   - Verify the Hypha server is accessible
