import os
from functools import partial
from fastapi import FastAPI
from fastapi.responses import HTMLResponse, FileResponse
from fastapi.staticfiles import StaticFiles


def mount_subdir(app, subdir, path):
    sub_path = os.path.join(path, subdir)
    app.mount(f"/{subdir}", StaticFiles(directory=sub_path), name=subdir)


def get_chatbot_api(workspace, service_id, build_dir):
    app = FastAPI(root_path=f"/{workspace}/apps/{service_id}")
    static_dir = os.path.join(os.path.dirname(__file__), "..", build_dir)

    # Mount standard static directories
    for subdir in ["static/js", "static/css", "img", "icons", "thebe", "monaco-editor"]:
        mount_subdir(app, subdir, static_dir)

    @app.get("/", response_class=HTMLResponse)
    async def root():
        return FileResponse(os.path.join(static_dir, "index.html"))

    # Catch-all route for SPA routing
    @app.get("/{rest_of_path:path}")
    async def spa_catch_all(rest_of_path: str):
        # Check if the path exists as a file
        file_path = os.path.join(static_dir, rest_of_path)
        if os.path.isfile(file_path):
            return FileResponse(file_path)
        # Otherwise return index.html for client-side routing
        return FileResponse(os.path.join(static_dir, "index.html"))

    return app


async def serve_fastapi(app, args, context=None):
    await app(args["scope"], args["receive"], args["send"])


async def register_frontend_service(server, workspace, service_id, build_dir):
    app = get_chatbot_api(workspace, service_id, build_dir)
    return await server.register_service(
        {
            "id": service_id,
            "name": f"{service_id} UI",
            "type": "asgi",
            "serve": partial(serve_fastapi, app),
            "config": {"visibility": "public"},
        }
    )
