from fastapi import FastAPI, HTTPException, Depends, Header
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from typing import Optional
import config
from crews import (
    create_summary_crew,
    create_kanban_crew,
    create_label_crew,
    create_reply_crew,
    create_general_crew
)

app = FastAPI(
    title="ZIB AI Service",
    description="Servico de IA para automacao do widget ZIB usando CrewAI",
    version="1.0.0"
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


async def verify_token(authorization: str = Header(None)):
    if not authorization:
        raise HTTPException(status_code=401, detail="Authorization header missing")
    
    token = authorization.replace("Bearer ", "")
    if token != config.AI_SERVICE_TOKEN:
        raise HTTPException(status_code=403, detail="Invalid token")
    
    return token


class CommandRequest(BaseModel):
    conversation_id: str
    instruction: str
    command_type: Optional[str] = "general"


class SummaryRequest(BaseModel):
    conversation_id: str


class ReplyRequest(BaseModel):
    conversation_id: str
    context: Optional[str] = None


class HealthResponse(BaseModel):
    status: str
    service: str
    version: str


@app.get("/health", response_model=HealthResponse)
async def health_check():
    return HealthResponse(
        status="healthy",
        service="ZIB AI Service",
        version="1.0.0"
    )


@app.post("/api/command")
async def execute_command(request: CommandRequest, token: str = Depends(verify_token)):
    try:
        if request.command_type == "kanban":
            crew = create_kanban_crew(request.conversation_id, request.instruction)
        elif request.command_type == "label":
            crew = create_label_crew(request.conversation_id, request.instruction)
        else:
            crew = create_general_crew(request.conversation_id, request.instruction)
        
        result = crew.kickoff()
        
        return {
            "success": True,
            "result": str(result),
            "conversation_id": request.conversation_id
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/api/summary")
async def generate_summary(request: SummaryRequest, token: str = Depends(verify_token)):
    try:
        crew = create_summary_crew(request.conversation_id)
        result = crew.kickoff()
        
        return {
            "success": True,
            "summary": str(result),
            "conversation_id": request.conversation_id
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/api/suggest-reply")
async def suggest_reply(request: ReplyRequest, token: str = Depends(verify_token)):
    try:
        crew = create_reply_crew(request.conversation_id, request.context)
        result = crew.kickoff()
        
        return {
            "success": True,
            "suggestions": str(result),
            "conversation_id": request.conversation_id
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8001)
