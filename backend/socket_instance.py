import os
from flask_socketio import SocketIO

def _get_socket_origins():
    origins = ["http://localhost:5173"]
    frontend_url = os.getenv("FRONTEND_URL", "")
    if frontend_url:
        origins.append(frontend_url)
    return origins

socketio = SocketIO(cors_allowed_origins=_get_socket_origins)
