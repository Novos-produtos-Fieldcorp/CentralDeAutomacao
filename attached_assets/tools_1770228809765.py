import httpx
from crewai.tools import tool
from config import NODE_API_URL, AI_SERVICE_TOKEN

headers = {
    "Authorization": f"Bearer {AI_SERVICE_TOKEN}",
    "Content-Type": "application/json"
}

@tool("Mover Conversa no Kanban")
def mover_conversa_kanban(conversation_id: str, stage_id: str) -> str:
    """Move uma conversa para uma etapa diferente do Kanban.
    Args:
        conversation_id: ID da conversa (chatId)
        stage_id: ID da etapa de destino no Kanban
    Returns:
        Mensagem de sucesso ou erro
    """
    try:
        with httpx.Client() as client:
            response = client.post(
                f"{NODE_API_URL}/api/ai/internal/move-kanban",
                json={"conversationId": conversation_id, "stageId": stage_id},
                headers=headers,
                timeout=30
            )
            if response.status_code == 200:
                return f"Conversa {conversation_id} movida para etapa {stage_id} com sucesso."
            return f"Erro ao mover conversa: {response.text}"
    except Exception as e:
        return f"Erro ao mover conversa: {str(e)}"


@tool("Criar Etiqueta")
def criar_etiqueta(name: str, color: str, group_id: str = None) -> str:
    """Cria uma nova etiqueta no sistema.
    Args:
        name: Nome da etiqueta
        color: Cor da etiqueta em hexadecimal (ex: #FF5733)
        group_id: ID do grupo de etiquetas (opcional)
    Returns:
        Mensagem de sucesso com ID da etiqueta ou erro
    """
    try:
        with httpx.Client() as client:
            response = client.post(
                f"{NODE_API_URL}/api/ai/internal/create-label",
                json={"name": name, "color": color, "groupId": group_id},
                headers=headers,
                timeout=30
            )
            if response.status_code == 200:
                data = response.json()
                return f"Etiqueta '{name}' criada com sucesso. ID: {data.get('id', 'N/A')}"
            return f"Erro ao criar etiqueta: {response.text}"
    except Exception as e:
        return f"Erro ao criar etiqueta: {str(e)}"


@tool("Aplicar Etiqueta")
def aplicar_etiqueta(conversation_id: str, label_id: str) -> str:
    """Aplica uma etiqueta a uma conversa.
    Args:
        conversation_id: ID da conversa
        label_id: ID da etiqueta a aplicar
    Returns:
        Mensagem de sucesso ou erro
    """
    try:
        with httpx.Client() as client:
            response = client.post(
                f"{NODE_API_URL}/api/ai/internal/apply-label",
                json={"conversationId": conversation_id, "labelId": label_id},
                headers=headers,
                timeout=30
            )
            if response.status_code == 200:
                return f"Etiqueta {label_id} aplicada a conversa {conversation_id} com sucesso."
            return f"Erro ao aplicar etiqueta: {response.text}"
    except Exception as e:
        return f"Erro ao aplicar etiqueta: {str(e)}"


@tool("Fixar Conversa")
def fixar_conversa(conversation_id: str, pinned: bool = True) -> str:
    """Fixa ou desfixa uma conversa.
    Args:
        conversation_id: ID da conversa
        pinned: True para fixar, False para desfixar
    Returns:
        Mensagem de sucesso ou erro
    """
    try:
        with httpx.Client() as client:
            response = client.post(
                f"{NODE_API_URL}/api/ai/internal/pin-conversation",
                json={"conversationId": conversation_id, "pinned": pinned},
                headers=headers,
                timeout=30
            )
            if response.status_code == 200:
                action = "fixada" if pinned else "desfixada"
                return f"Conversa {conversation_id} {action} com sucesso."
            return f"Erro ao fixar conversa: {response.text}"
    except Exception as e:
        return f"Erro ao fixar conversa: {str(e)}"


@tool("Buscar Mensagens da Conversa")
def buscar_mensagens(conversation_id: str, limit: int = 50) -> str:
    """Busca as mensagens de uma conversa para analise.
    Args:
        conversation_id: ID da conversa (chatId)
        limit: Numero maximo de mensagens a retornar
    Returns:
        Lista de mensagens formatadas ou erro
    """
    try:
        with httpx.Client() as client:
            response = client.get(
                f"{NODE_API_URL}/api/ai/internal/messages/{conversation_id}",
                params={"limit": limit},
                headers=headers,
                timeout=30
            )
            if response.status_code == 200:
                messages = response.json().get("messages", [])
                if not messages:
                    return "Nenhuma mensagem encontrada nesta conversa."
                
                formatted = []
                for msg in messages:
                    sender = "Cliente" if msg.get("fromMe") == False else "Atendente"
                    text = msg.get("body", msg.get("text", "[sem texto]"))
                    formatted.append(f"[{sender}]: {text}")
                
                return "\n".join(formatted)
            return f"Erro ao buscar mensagens: {response.text}"
    except Exception as e:
        return f"Erro ao buscar mensagens: {str(e)}"


@tool("Listar Etapas do Kanban")
def listar_etapas_kanban(pipeline_id: str = None) -> str:
    """Lista as etapas disponiveis no Kanban.
    Args:
        pipeline_id: ID do pipeline (opcional, usa o primeiro se nao especificado)
    Returns:
        Lista de etapas com IDs e nomes
    """
    try:
        with httpx.Client() as client:
            response = client.get(
                f"{NODE_API_URL}/api/ai/internal/kanban-stages",
                params={"pipelineId": pipeline_id} if pipeline_id else {},
                headers=headers,
                timeout=30
            )
            if response.status_code == 200:
                stages = response.json().get("stages", [])
                if not stages:
                    return "Nenhuma etapa encontrada no Kanban."
                
                formatted = ["Etapas disponiveis:"]
                for stage in stages:
                    formatted.append(f"- {stage.get('name', 'N/A')} (ID: {stage.get('id', 'N/A')})")
                
                return "\n".join(formatted)
            return f"Erro ao listar etapas: {response.text}"
    except Exception as e:
        return f"Erro ao listar etapas: {str(e)}"


@tool("Listar Etiquetas")
def listar_etiquetas() -> str:
    """Lista todas as etiquetas disponiveis no sistema.
    Returns:
        Lista de etiquetas com IDs, nomes e cores
    """
    try:
        with httpx.Client() as client:
            response = client.get(
                f"{NODE_API_URL}/api/ai/internal/labels",
                headers=headers,
                timeout=30
            )
            if response.status_code == 200:
                labels = response.json().get("labels", [])
                if not labels:
                    return "Nenhuma etiqueta encontrada."
                
                formatted = ["Etiquetas disponiveis:"]
                for label in labels:
                    formatted.append(f"- {label.get('name', 'N/A')} (ID: {label.get('id', 'N/A')}, Cor: {label.get('color', 'N/A')})")
                
                return "\n".join(formatted)
            return f"Erro ao listar etiquetas: {response.text}"
    except Exception as e:
        return f"Erro ao listar etiquetas: {str(e)}"
