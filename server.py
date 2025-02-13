from fastapi import FastAPI, WebSocket
from fastapi.responses import HTMLResponse
from typing import List
import uvicorn

server = FastAPI()


class ConnectionManager:
    def __init__(self):
        self.active_connections: List[WebSocket] = []

    async def connect(self, websocket: WebSocket):
        await websocket.accept()
        self.active_connections.append(websocket)

    async def disconnect(self, websocket: WebSocket):
        self.active_connections.remove(websocket)

    async def broadcast(self, message: str):
        for connection in self.active_connections:
            await connection.send_text(message)

    def __str__(self):
        return str(self.active_connections)

manager = ConnectionManager()
print(manager)

@server.websocket("/ws")
async def websocket_endpoint(websocket: WebSocket):
    print("New websocket connection") 
    await manager.connect(websocket)
    try:
        while True:
            data = await websocket.receive_bytes()
            print("Received video chunk of size:", len(data))
            # Process incoming frame data
            # Broadcast to other clients if needed
        #await manager.broadcast(data)
    except Exception as e:
        print(f"Error: {e}")
    finally:
        await manager.disconnect(websocket)


@server.get("/")
def main_root():
    with open("./public/index.html") as file:
        html_content = file.read()
    return HTMLResponse(content=html_content)




uvicorn.run(server, host="localhost", port=8000)