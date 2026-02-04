import httpx
from crewai.tools import tool
from config import WISEAPP_API_URL


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


@tool("Buscar Mensagens do Inbox")
def buscar_mensagens_inbox(inbox_id: str, account_id: str, api_key: str, limit: int = 100) -> str:
    """Busca as mensagens de um inbox/grupo para analise.
    Args:
        inbox_id: ID do inbox (grupo)
        account_id: ID da conta WiseApp
        api_key: Token de API do WiseApp
        limit: Numero maximo de mensagens a retornar
    Returns:
        Lista de mensagens formatadas ou erro
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
                timeout=30
            )
            
            if response.status_code != 200:
                return f"Erro ao buscar conversas: {response.text}"
            
            conversations = response.json()
            if not conversations:
                return "Nenhuma conversa encontrada neste inbox."
            
            all_messages = []
            for conv in conversations[:20]:
                conv_id = conv.get("id")
                if conv_id:
                    msg_response = client.get(
                        f"{WISEAPP_API_URL}/v1/accounts/{account_id}/conversations/{conv_id}/messages",
                        headers=headers,
                        params={"limit": 10},
                        timeout=30
                    )
                    
                    if msg_response.status_code == 200:
                        messages = msg_response.json().get("payload", [])
                        contact_name = conv.get("meta", {}).get("sender", {}).get("name", "Desconhecido")
                        
                        for msg in messages[-5:]:
                            sender = contact_name if msg.get("message_type") == 0 else "Atendente"
                            content = msg.get("content", "[sem texto]")
                            if content:
                                all_messages.append(f"[{sender}]: {content}")
            
            if not all_messages:
                return "Nenhuma mensagem encontrada nas conversas."
            
            return "\n".join(all_messages[-limit:])
            
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
