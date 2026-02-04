import httpx
from datetime import datetime, timezone, timedelta
from crewai.tools import tool
from config import WISEAPP_API_URL

# Brasilia timezone (UTC-3)
BRASILIA_TZ = timezone(timedelta(hours=-3))


def send_message_to_inbox(inbox_id: str, account_id: str, api_key: str, message: str, group_name: str = None) -> dict:
    """Envia uma mensagem para o inbox do WiseApp (nao e uma tool do CrewAI)
    
    Args:
        inbox_id: ID do inbox
        account_id: ID da conta WiseApp
        api_key: Token de API
        message: Mensagem a enviar
        group_name: Nome do grupo para matching (opcional)
    """
    try:
        headers = {
            "api_access_token": api_key,
            "Content-Type": "application/json"
        }
        
        with httpx.Client() as client:
            # Get conversations from the inbox
            response = client.get(
                f"{WISEAPP_API_URL}/v1/accounts/{account_id}/inboxes/{inbox_id}/conversations",
                headers=headers,
                params={"status": "all", "page": 1},
                timeout=30
            )
            
            if response.status_code != 200:
                return {"success": False, "error": f"Failed to get conversations: {response.text}"}
            
            conversations = response.json()
            if not conversations or len(conversations) == 0:
                return {"success": False, "error": "No conversations found in inbox"}
            
            # Try to find the group conversation by name matching
            target_conv = None
            if group_name:
                group_name_lower = group_name.lower()
                for conv in conversations:
                    conv_name = conv.get("meta", {}).get("sender", {}).get("name", "")
                    if conv_name and group_name_lower in conv_name.lower():
                        target_conv = conv
                        break
            
            # Fallback to the most recent conversation if no match found
            if not target_conv:
                target_conv = conversations[0]
            
            conv_id = target_conv.get("id")
            if not conv_id:
                return {"success": False, "error": "No valid conversation found"}
            
            msg_response = client.post(
                f"{WISEAPP_API_URL}/v1/accounts/{account_id}/conversations/{conv_id}/messages",
                headers=headers,
                json={
                    "content": message,
                    "message_type": "outgoing",
                    "private": False
                },
                timeout=30
            )
            
            if msg_response.status_code in [200, 201]:
                return {"success": True, "conversation_id": conv_id}
            else:
                return {"success": False, "error": f"Failed to send message: {msg_response.text}"}
                
    except Exception as e:
        return {"success": False, "error": str(e)}


def get_today_brasilia():
    """Retorna a data de hoje no fuso horario de Brasilia"""
    now = datetime.now(BRASILIA_TZ)
    return now.date()


def is_message_from_today(message: dict) -> bool:
    """Verifica se uma mensagem foi enviada hoje (horario de Brasilia)"""
    try:
        created_at = message.get("created_at")
        if not created_at:
            return False
        
        # Parse the timestamp (format: 2025-02-04T10:30:00.000Z or Unix timestamp)
        if isinstance(created_at, (int, float)):
            msg_time = datetime.fromtimestamp(created_at, tz=timezone.utc)
        else:
            # Handle ISO format string
            if created_at.endswith('Z'):
                created_at = created_at[:-1] + '+00:00'
            msg_time = datetime.fromisoformat(created_at.replace('Z', '+00:00'))
        
        # Convert to Brasilia timezone and compare dates
        msg_date_brasilia = msg_time.astimezone(BRASILIA_TZ).date()
        today_brasilia = get_today_brasilia()
        
        return msg_date_brasilia == today_brasilia
    except Exception:
        return False


@tool("Buscar Mensagens do Inbox")
def buscar_mensagens_inbox(inbox_id: str, account_id: str, api_key: str, limit: int = 80) -> str:
    """Busca as mensagens de um inbox/grupo para analise, filtrando apenas as de HOJE.
    Args:
        inbox_id: ID do inbox (grupo)
        account_id: ID da conta WiseApp
        api_key: Token de API do WiseApp
        limit: Numero maximo de mensagens a retornar
    Returns:
        Lista de mensagens do dia formatadas ou erro
    """
    try:
        headers = {
            "api_access_token": api_key,
            "Content-Type": "application/json"
        }
        
        with httpx.Client() as client:
            # Buscar conversas do inbox
            response = client.get(
                f"{WISEAPP_API_URL}/v1/accounts/{account_id}/inboxes/{inbox_id}/conversations",
                headers=headers,
                params={"status": "all", "page": 1},
                timeout=30
            )
            
            if response.status_code != 200:
                return f"Erro ao buscar conversas: {response.text}"
            
            conversations = response.json()
            if not conversations:
                return "Nenhuma conversa encontrada neste inbox."
            
            # Pegar a primeira conversa (o grupo)
            conv = conversations[0] if conversations else None
            if not conv:
                return "Nenhuma conversa encontrada."
            
            conv_id = conv.get("id")
            group_name = conv.get("meta", {}).get("sender", {}).get("name", "Grupo")
            
            # Buscar mensagens da conversa (pegar mais mensagens para filtrar)
            msg_response = client.get(
                f"{WISEAPP_API_URL}/v1/accounts/{account_id}/conversations/{conv_id}/messages",
                headers=headers,
                params={"limit": 200},  # Buscar mais para garantir que pegamos todas do dia
                timeout=60
            )
            
            if msg_response.status_code != 200:
                return f"Erro ao buscar mensagens: {msg_response.text}"
            
            messages_data = msg_response.json()
            messages = messages_data.get("payload", [])
            
            if not messages:
                return "Nenhuma mensagem encontrada na conversa."
            
            # Filtrar apenas mensagens de hoje
            today_messages = []
            for msg in messages:
                if is_message_from_today(msg):
                    # Pegar nome do remetente
                    sender_info = msg.get("sender", {})
                    sender_name = sender_info.get("name", "Desconhecido")
                    
                    # Tipo de mensagem: 0 = incoming, 1 = outgoing
                    msg_type = msg.get("message_type")
                    if msg_type == 1:
                        sender_name = "Atendente"
                    
                    content = msg.get("content", "")
                    content_type = msg.get("content_type", "text")
                    
                    # Tratar tipos de conteudo
                    if content_type == "image":
                        content = "[Imagem enviada]"
                    elif content_type == "audio":
                        content = "[Audio enviado]"
                    elif content_type == "video":
                        content = "[Video enviado]"
                    elif content_type == "file":
                        content = "[Arquivo enviado]"
                    elif content_type == "sticker":
                        content = "[Sticker]"
                    elif not content:
                        content = "[Mensagem sem texto]"
                    
                    # Pegar horario da mensagem
                    created_at = msg.get("created_at", "")
                    time_str = ""
                    try:
                        if isinstance(created_at, (int, float)):
                            msg_time = datetime.fromtimestamp(created_at, tz=timezone.utc)
                        else:
                            msg_time = datetime.fromisoformat(created_at.replace('Z', '+00:00'))
                        msg_time_brasilia = msg_time.astimezone(BRASILIA_TZ)
                        time_str = msg_time_brasilia.strftime("%H:%M")
                    except Exception:
                        pass
                    
                    today_messages.append({
                        "sender": sender_name,
                        "content": content,
                        "time": time_str
                    })
            
            if not today_messages:
                return f"Nenhuma mensagem encontrada hoje no grupo '{group_name}'."
            
            # Formatar mensagens (mais antigas primeiro)
            today_messages.reverse()
            formatted = [f"MENSAGENS DO DIA - {group_name}"]
            formatted.append(f"Data: {get_today_brasilia().strftime('%d/%m/%Y')}")
            formatted.append(f"Total de mensagens hoje: {len(today_messages)}")
            formatted.append("-" * 40)
            
            for msg in today_messages[-limit:]:
                time_prefix = f"[{msg['time']}] " if msg['time'] else ""
                formatted.append(f"{time_prefix}{msg['sender']}: {msg['content']}")
            
            return "\n".join(formatted)
            
    except Exception as e:
        return f"Erro ao buscar mensagens: {str(e)}"


@tool("Buscar Conversas Recentes")
def buscar_conversas_recentes(inbox_id: str, account_id: str, api_key: str) -> str:
    """Busca informacoes sobre conversas recentes de um inbox.
    Args:
        inbox_id: ID do inbox (grupo)
        account_id: ID da conta WiseApp
        api_key: Token de API do WiseApp
    Returns:
        Resumo das conversas recentes
    """
    try:
        headers = {
            "api_access_token": api_key,
            "Content-Type": "application/json"
        }
        
        with httpx.Client() as client:
            response = client.get(
                f"{WISEAPP_API_URL}/v1/accounts/{account_id}/inboxes/{inbox_id}/conversations",
                headers=headers,
                params={"status": "all"},
                timeout=30
            )
            
            if response.status_code != 200:
                return f"Erro ao buscar conversas: {response.text}"
            
            conversations = response.json()
            if not conversations:
                return "Nenhuma conversa encontrada."
            
            stats = {
                "total": len(conversations),
                "abertas": 0,
                "resolvidas": 0,
                "pendentes": 0
            }
            
            contatos = []
            for conv in conversations[:20]:
                status = conv.get("status", "unknown")
                if status == "open":
                    stats["abertas"] += 1
                elif status == "resolved":
                    stats["resolvidas"] += 1
                elif status == "pending":
                    stats["pendentes"] += 1
                
                contact_name = conv.get("meta", {}).get("sender", {}).get("name", "Desconhecido")
                contatos.append(contact_name)
            
            resumo = f"""Estatisticas do Inbox:
- Total de conversas recentes: {stats['total']}
- Conversas abertas: {stats['abertas']}
- Conversas resolvidas: {stats['resolvidas']}
- Conversas pendentes: {stats['pendentes']}

Contatos recentes: {', '.join(set(contatos[:10]))}"""
            
            return resumo
            
    except Exception as e:
        return f"Erro ao buscar conversas: {str(e)}"
