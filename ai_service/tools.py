import httpx
from crewai.tools import tool
from config import WISEAPP_API_URL


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
