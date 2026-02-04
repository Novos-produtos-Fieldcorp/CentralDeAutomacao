from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from typing import Optional, Union
import config
from crews import create_group_summary_crew, create_quick_summary_crew
from tools import send_message_to_inbox

app = FastAPI(
    title="AI Summary Service",
    description="Servico de IA para geracao de resumos de grupos usando CrewAI",
    version="1.0.0"
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


class GroupSummaryRequest(BaseModel):
    nome_do_grupo: str
    company_id: Union[int, str]
    group_id: Union[int, str]
    account_id: Optional[Union[int, str]] = None
    api_key: Optional[str] = None
    inbox_id: Optional[Union[int, str]] = None
    quick_mode: Optional[bool] = False


class HealthResponse(BaseModel):
    status: str
    service: str
    version: str


@app.get("/health", response_model=HealthResponse)
async def health_check():
    return HealthResponse(
        status="healthy",
        service="AI Summary Service",
        version="1.0.0"
    )


@app.post("/api/group-summary")
async def generate_group_summary(request: GroupSummaryRequest):
    try:
        if not request.account_id or not request.api_key:
            return {
                "success": False,
                "error": "account_id e api_key sao obrigatorios",
                "group_id": request.group_id
            }
        
        # inbox_id is optional - if not provided, generate a basic summary without message fetching
        inbox_id = str(request.inbox_id) if request.inbox_id else None
        account_id = str(request.account_id)
        api_key = request.api_key
        group_name = request.nome_do_grupo
        
        if inbox_id:
            # Full summary with message fetching
            if request.quick_mode:
                crew = create_quick_summary_crew(inbox_id, account_id, api_key, group_name)
            else:
                crew = create_group_summary_crew(inbox_id, account_id, api_key, group_name)
            
            result = crew.kickoff()
            summary_text = str(result)
        else:
            # Basic summary without inbox
            summary_text = f"RESUMO DO GRUPO: {group_name}\n\nInbox nao configurado - configure o inbox_id para obter resumos detalhados das conversas."
        
        # Send summary to WiseApp if inbox_id is available
        message_sent = False
        send_error = None
        if inbox_id:
            send_result = send_message_to_inbox(inbox_id, account_id, api_key, summary_text, group_name)
            message_sent = send_result.get("success", False)
            if not message_sent:
                send_error = send_result.get("error")
                print(f"Warning: Failed to send summary to WiseApp: {send_error}")
        
        return {
            "success": True,
            "summary": summary_text,
            "group_id": request.group_id,
            "group_name": request.nome_do_grupo,
            "message_sent": message_sent,
            "send_error": send_error
        }
        
    except Exception as e:
        print(f"Error generating summary: {str(e)}")
        return {
            "success": False,
            "error": str(e),
            "group_id": request.group_id
        }


@app.post("/webhook/resumo-grupo")
async def webhook_resumo_grupo(request: GroupSummaryRequest):
    """Endpoint compativel com o formato do webhook n8n antigo"""
    return await generate_group_summary(request)


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=config.AI_SERVICE_PORT)
