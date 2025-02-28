import asyncio
import json
import logging
from typing import Dict, List, Optional, Set, Union, Any

from aiohttp import web
import aiohttp_cors
from pydantic import BaseModel

from core.config import WebUIConfig
from core.log import get_logger
from core.ui.base import UIBase, UIClosedError, UISource, UserInput, pythagora_source

log = get_logger(__name__)

class WebSocketMessageType:
    STREAM = "stream"
    MESSAGE = "message"
    KEY_EXPIRED = "key_expired"
    APP_FINISHED = "app_finished"
    FEATURE_FINISHED = "feature_finished"
    QUESTION = "question"
    PROJECT_STAGE = "project_stage"
    EPICS_AND_TASKS = "epics_and_tasks"
    TASK_PROGRESS = "task_progress"
    STEP_PROGRESS = "step_progress"
    MODIFIED_FILES = "modified_files"
    DATA_ABOUT_LOGS = "data_about_logs"
    RUN_COMMAND = "run_command"
    APP_LINK = "app_link"
    OPEN_EDITOR = "open_editor"
    PROJECT_ROOT = "project_root"
    PROJECT_STATS = "project_stats"
    TEST_INSTRUCTIONS = "test_instructions"
    KNOWLEDGE_BASE_UPDATE = "knowledge_base_update"
    FILE_STATUS = "file_status"
    BUG_HUNTER_STATUS = "bug_hunter_status"
    GENERATE_DIFF = "generate_diff"
    CLOSE_DIFF = "close_diff"
    LOADING_FINISHED = "loading_finished"
    PROJECT_DESCRIPTION = "project_description"
    FEATURES_LIST = "features_list"
    IMPORT_PROJECT = "import_project"


class WebUIServer(UIBase):
    """Web UI implementation using aiohttp web server and WebSockets."""

    def __init__(self, config: WebUIConfig):
        self.host = config.host
        self.port = config.port
        self.static_path = config.static_path
        self.app = web.Application()
        self.cors = aiohttp_cors.setup(self.app)
        self.sockets: Set[web.WebSocketResponse] = set()
        self.pending_questions: Dict[str, asyncio.Future] = {}
        self.question_id_counter = 0
        self.running = False
        self.runner = None
        self.site = None

        # Configure routes
        self.app.router.add_get("/ws", self._handle_websocket)
        
        # Add static file handling for the frontend
        if self.static_path:
            self.app.router.add_static("/", self.static_path)
            # Special case for the root path
            self.app.router.add_get("/", self._handle_root)

        # Configure CORS for API endpoints
        cors = aiohttp_cors.setup(self.app, defaults={
            "*": aiohttp_cors.ResourceOptions(
                allow_credentials=True,
                expose_headers="*",
                allow_headers="*",
            )
        })

        # Apply CORS to all routes
        for route in list(self.app.router.routes()):
            if not isinstance(route.resource, web.StaticResource):
                cors.add(route)

    async def _handle_root(self, request):
        """Serve the index.html file for the root path."""
        return web.FileResponse(f"{self.static_path}/index.html")

    async def _handle_websocket(self, request):
        """Handle WebSocket connections."""
        ws = web.WebSocketResponse()
        await ws.prepare(request)
        self.sockets.add(ws)
        
        try:
            async for msg in ws:
                if msg.type == web.WSMsgType.TEXT:
                    try:
                        data = json.loads(msg.data)
                        message_type = data.get("type")
                        
                        if message_type == "response" and "question_id" in data:
                            question_id = data["question_id"]
                            if question_id in self.pending_questions:
                                future = self.pending_questions.pop(question_id)
                                user_input = UserInput(
                                    text=data.get("text"),
                                    button=data.get("button"),
                                    cancelled=data.get("cancelled", False)
                                )
                                future.set_result(user_input)
                    except json.JSONDecodeError:
                        log.error(f"Invalid JSON received: {msg.data}")
                    except Exception as e:
                        log.error(f"Error processing message: {e}")
                        
                elif msg.type == web.WSMsgType.ERROR:
                    log.error(f"WebSocket error: {ws.exception()}")
        finally:
            self.sockets.remove(ws)
            
        return ws

    async def _broadcast(self, message: dict):
        """Broadcast a message to all connected WebSocket clients."""
        if not self.sockets:
            log.warning("No WebSocket connections to broadcast to")
            
        message_json = json.dumps(message)
        for ws in self.sockets:
            try:
                await ws.send_str(message_json)
            except Exception as e:
                log.error(f"Error sending message to client: {e}")

    async def start(self) -> bool:
        """Start the web server."""
        try:
            self.runner = web.AppRunner(self.app)
            await self.runner.setup()
            self.site = web.TCPSite(self.runner, self.host, self.port)
            await self.site.start()
            self.running = True
            log.info(f"Web UI server started at http://{self.host}:{self.port}")
            return True
        except Exception as e:
            log.error(f"Failed to start Web UI server: {e}")
            return False

    async def stop(self):
        """Stop the web server."""
        if self.running:
            # Close all WebSocket connections
            for ws in list(self.sockets):
                await ws.close()
            
            # Shutdown the server
            if self.site:
                await self.site.stop()
            if self.runner:
                await self.runner.cleanup()
            
            self.running = False
            log.info("Web UI server stopped")

    async def send_stream_chunk(
        self, chunk: str, *, source: Optional[UISource] = None, project_state_id: Optional[str] = None
    ):
        """Send a stream chunk to the web UI."""
        if not self.running:
            raise UIClosedError()
        
        await self._broadcast({
            "type": WebSocketMessageType.STREAM,
            "chunk": chunk,
            "source": source.type_name if source else None,
            "source_display_name": str(source) if source else None,
            "project_state_id": project_state_id
        })

    async def send_message(
        self,
        message: str,
        *,
        source: Optional[UISource] = None,
        project_state_id: Optional[str] = None,
        extra_info: Optional[str] = None,
    ):
        """Send a message to the web UI."""
        if not self.running:
            raise UIClosedError()
        
        await self._broadcast({
            "type": WebSocketMessageType.MESSAGE,
            "message": message,
            "source": source.type_name if source else None,
            "source_display_name": str(source) if source else None,
            "project_state_id": project_state_id,
            "extra_info": extra_info
        })

    async def ask_question(
        self,
        question: str,
        *,
        buttons: Optional[dict[str, str]] = None,
        default: Optional[str] = None,
        buttons_only: bool = False,
        allow_empty: bool = False,
        full_screen: Optional[bool] = False,
        hint: Optional[str] = None,
        verbose: bool = True,
        initial_text: Optional[str] = None,
        source: Optional[UISource] = None,
        project_state_id: Optional[str] = None,
        extra_info: Optional[str] = None,
        placeholder: Optional[str] = None,
    ) -> UserInput:
        """Ask a question to the user via the web UI."""
        if not self.running:
            raise UIClosedError()
        
        if not self.sockets:
            raise UIClosedError("No WebSocket connections available")
        
        self.question_id_counter += 1
        question_id = str(self.question_id_counter)
        
        # Create a future to wait for the response
        future = asyncio.Future()
        self.pending_questions[question_id] = future
        
        # Send the question
        await self._broadcast({
            "type": WebSocketMessageType.QUESTION,
            "question_id": question_id,
            "question": question,
            "buttons": buttons,
            "default": default,
            "buttons_only": buttons_only,
            "allow_empty": allow_empty,
            "full_screen": full_screen,
            "hint": hint,
            "verbose": verbose,
            "initial_text": initial_text,
            "source": source.type_name if source else None,
            "source_display_name": str(source) if source else None,
            "project_state_id": project_state_id,
            "extra_info": extra_info,
            "placeholder": placeholder
        })
        
        try:
            # Wait for the response
            return await future
        except asyncio.CancelledError:
            if question_id in self.pending_questions:
                del self.pending_questions[question_id]
            raise UIClosedError()

    # Implement the remaining UIBase methods in a similar way
    # Each method will broadcast the appropriate message type
    
    async def send_project_stage(self, data: dict):
        """Send project stage update to the web UI."""
        if not self.running:
            raise UIClosedError()
        
        await self._broadcast({
            "type": WebSocketMessageType.PROJECT_STAGE,
            "data": data
        })
    
    async def send_epics_and_tasks(
        self,
        epics: list[dict] = None,
        tasks: list[dict] = None,
    ):
        """Send epics and tasks to the web UI."""
        if not self.running:
            raise UIClosedError()
        
        await self._broadcast({
            "type": WebSocketMessageType.EPICS_AND_TASKS,
            "epics": epics or [],
            "tasks": tasks or []
        })
    
    # Implement other methods similarly
    # ...
    
    async def send_task_progress(
        self,
        index: int,
        n_tasks: int,
        description: str,
        source: str,
        status: str,
        source_index: int = 1,
        tasks: list[dict] = None,
    ):
        """Send task progress to the web UI."""
        if not self.running:
            raise UIClosedError()
        
        await self._broadcast({
            "type": WebSocketMessageType.TASK_PROGRESS,
            "index": index,
            "n_tasks": n_tasks,
            "description": description,
            "source": source,
            "status": status,
            "source_index": source_index,
            "tasks": tasks
        })
    
    async def send_step_progress(
        self,
        index: int,
        n_steps: int,
        step: dict,
        task_source: str,
    ):
        """Send step progress to the web UI."""
        if not self.running:
            raise UIClosedError()
        
        await self._broadcast({
            "type": WebSocketMessageType.STEP_PROGRESS,
            "index": index,
            "n_steps": n_steps,
            "step": step,
            "task_source": task_source
        })
    
    # Implement other required methods following the same pattern as above
    # ... 