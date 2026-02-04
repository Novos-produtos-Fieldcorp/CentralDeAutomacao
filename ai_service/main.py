from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from typing import Optional, Union
from datetime import datetime, timezone, timedelta
import httpx
import config
from crews import create_group_summary_crew, create_quick_summary_crew
from tools import send_message_to_inbox

# Brasilia timezone (UTC-3)
BRASILIA_TZ = timezone(timedelta(hours=-3))


async def registrar_log_envio(
    grupo_id: int,
    company_id: int,
    status: bool,
    mensagem: str,
    resumo_grupo: str = None
):
    """Registra o log de envio do resumo na tabela envio_resumo do Supabase"""
    try:
        if not config.SUPABASE_URL or not config.SUPABASE_KEY:
            print("Warning: Supabase nao configurado, log nao sera salvo")
            return
        
        now_brasilia = datetime.now(BRASILIA_TZ)
        now_utc = datetime.now(timezone.utc)
        
        data = {
            "grupo_id": grupo_id,
            "company_id": company_id,
            "data_envio": now_brasilia.strftime("%Y-%m-%d"),
            "status": status,
            "mensagem": mensagem[:1000] if mensagem else None,  # Limitar tamanho
            "horario_execucao_utc": now_utc.strftime("%H:%M"),
            "resumo_grupo": resumo_grupo[:5000] if resumo_grupo else None  # Limitar tamanho
        }
        
        async with httpx.AsyncClient() as client:
            response = await client.post(
                f"{config.SUPABASE_URL}/rest/v1/envio_resumo",
                headers={
                    "apikey": config.SUPABASE_KEY,
                    "Authorization": f"Bearer {config.SUPABASE_KEY}",
                    "Content-Type": "application/json",
                    "Prefer": "return=minimal"
                },
                json=data,
                timeout=10
            )
            
            if response.status_code in [200, 201, 204]:
                print(f"Log de envio registrado com sucesso para grupo_id={grupo_id}")
            else:
                print(f"Erro ao registrar log: {response.status_code} - {response.text}")
                
    except Exception as e:
        print(f"Erro ao registrar log no Supabase: {str(e)}")


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
    grupo_id = int(request.group_id) if request.group_id else 0
    company_id = int(request.company_id) if request.company_id else 0
    
    try:
        if not request.account_id or not request.api_key:
            error_msg = "account_id e api_key sao obrigatorios"
            await registrar_log_envio(grupo_id, company_id, False, error_msg)
            return {
                "success": False,
                "error": error_msg,
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
            await registrar_log_envio(grupo_id, company_id, False, "Inbox nao configurado", summary_text)
        
        # Send summary to WiseApp if inbox_id is available
        message_sent = False
        send_error = None
        if inbox_id:
            send_result = send_message_to_inbox(inbox_id, account_id, api_key, summary_text, group_name)
            message_sent = send_result.get("success", False)
            if not message_sent:
                send_error = send_result.get("error")
                print(f"Warning: Failed to send summary to WiseApp: {send_error}")
        
        # Registrar log no Supabase
        if message_sent:
            await registrar_log_envio(grupo_id, company_id, True, "Resumo gerado e enviado com sucesso", summary_text)
        else:
            log_msg = f"Resumo gerado mas falha no envio: {send_error}" if send_error else "Resumo gerado"
            await registrar_log_envio(grupo_id, company_id, False, log_msg, summary_text)
        
        return {
            "success": True,
            "summary": summary_text,
            "group_id": request.group_id,
            "group_name": request.nome_do_grupo,
            "message_sent": message_sent,
            "send_error": send_error
        }
        
    except Exception as e:
        error_msg = f"Erro ao gerar resumo: {str(e)}"
        print(f"Error generating summary: {str(e)}")
        await registrar_log_envio(grupo_id, company_id, False, error_msg)
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
