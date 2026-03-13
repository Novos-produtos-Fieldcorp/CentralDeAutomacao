import httpx
from datetime import datetime, timezone, timedelta
from crewai.tools import tool
from config import WISEAPP_API_URL

# Brasilia timezone (UTC-3)
BRASILIA_TZ = timezone(timedelta(hours=-3))


def _search_convs_by_name(client, account_id: str, api_key: str, group_name: str, max_pages: int = 20) -> dict | None:
    """Busca uma conversa por nome do grupo varrendo todas as conversas da conta."""
    headers = {
        "api_access_token": api_key,
        "Content-Type": "application/json"
    }
    best_match = None
    first_conv = None

    for page in range(1, max_pages + 1):
        resp = client.get(
            f"{WISEAPP_API_URL}/v1/accounts/{account_id}/conversations",
            headers=headers,
            params={"page": page},
            timeout=30
        )
        if resp.status_code != 200:
            break

        data = resp.json()
        convs = data.get("data", {}).get("payload", [])
        if not convs:
            break

        for conv in convs:
            if first_conv is None:
                first_conv = conv
            meta = conv.get("meta", {})
            name = meta.get("sender", {}).get("name", "")
            if group_name and any(part.lower() in name.lower() for part in group_name.split("/")):
                best_match = conv
                break

        if best_match:
            break

        total_count = data.get("data", {}).get("meta", {}).get("all_count", 0)
        if page * 25 >= total_count:
            break

    chosen = best_match
    if not chosen:
        return None

    conv_id = chosen.get("id")
    conv_name = chosen.get("meta", {}).get("sender", {}).get("name", group_name)
    return {"conv_id": conv_id, "conv_name": conv_name}


def find_group_conversation(account_id: str, api_key: str, inbox_id: str, group_name: str) -> dict:
    """Encontra a conversa do grupo dentro de um inbox do WiseApp.
    
    Estrategia:
    1. Lista conversas do inbox pelo inbox_id
    2. Tenta encontrar pelo nome do grupo; cai na primeira se nao achar
    3. Se inbox estiver vazio, busca por nome em todas as conversas da conta (fallback)
    
    Returns:
        dict com 'conv_id' e 'conv_name', ou None em erro
    """
    headers = {
        "api_access_token": api_key,
        "Content-Type": "application/json"
    }

    with httpx.Client() as client:
        page = 1
        best_match = None
        first_conv = None

        while True:
            resp = client.get(
                f"{WISEAPP_API_URL}/v1/accounts/{account_id}/conversations",
                headers=headers,
                params={"inbox_id": inbox_id, "page": page},
                timeout=30
            )

            if resp.status_code != 200:
                print(f"Erro ao listar conversas (inbox {inbox_id}): {resp.status_code} {resp.text[:200]}")
                break

            data = resp.json()
            payload = data.get("data", {})
            convs = payload.get("payload", [])

            if not convs:
                break

            for conv in convs:
                if first_conv is None:
                    first_conv = conv

                meta = conv.get("meta", {})
                sender = meta.get("sender", {})
                name = sender.get("name", "") or ""

                if group_name and group_name.lower() in name.lower():
                    best_match = conv
                    break

            if best_match:
                break

            total_count = data.get("data", {}).get("meta", {}).get("all_count", 0)
            if page * 25 >= total_count:
                break
            page += 1

        chosen = best_match or first_conv

        # Fallback: inbox vazio — busca por nome em toda a conta
        if not chosen and group_name:
            print(f"Inbox {inbox_id} vazio. Buscando grupo '{group_name}' em toda a conta {account_id}...")
            chosen_data = _search_convs_by_name(client, account_id, api_key, group_name)
            if chosen_data:
                print(f"Grupo encontrado via busca global: {chosen_data['conv_name']} (conv {chosen_data['conv_id']})")
                return chosen_data

        if not chosen:
            return None

        conv_id = chosen.get("id")
        meta = chosen.get("meta", {})
        conv_name = meta.get("sender", {}).get("name", group_name)
        return {"conv_id": conv_id, "conv_name": conv_name}


def send_message_to_inbox(inbox_id: str, account_id: str, api_key: str, message: str, group_name: str = None) -> dict:
    """Envia uma mensagem para o grupo no WiseApp.
    
    Fluxo:
    1. Busca conversas do inbox pelo inbox_id
    2. Encontra a conversa do grupo (por nome ou primeira disponivel)
    3. Envia mensagem na conversa
    
    Args:
        inbox_id: ID do inbox WiseApp
        account_id: ID da conta WiseApp
        api_key: Token de API
        message: Mensagem a enviar
        group_name: Nome do grupo para busca (opcional)
    """
    try:
        if not inbox_id:
            return {"success": False, "error": "inbox_id nao informado"}

        conv = find_group_conversation(account_id, api_key, inbox_id, group_name or "")
        if not conv:
            return {"success": False, "error": f"Nenhuma conversa encontrada no inbox {inbox_id}"}

        conv_id = conv["conv_id"]
        headers = {
            "api_access_token": api_key,
            "Content-Type": "application/json"
        }

        with httpx.Client() as client:
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
        if created_at is None:
            return False

        if isinstance(created_at, (int, float)):
            msg_time = datetime.fromtimestamp(created_at, tz=timezone.utc)
        else:
            if created_at.endswith('Z'):
                created_at = created_at[:-1] + '+00:00'
            msg_time = datetime.fromisoformat(created_at.replace('Z', '+00:00'))

        msg_date_brasilia = msg_time.astimezone(BRASILIA_TZ).date()
        today_brasilia = get_today_brasilia()

        return msg_date_brasilia == today_brasilia
    except Exception:
        return False


_BOT_SUMMARY_SIGNATURES = [
    "gerado automaticamente pela IAzinha",
    "Resumo do Grupo",
    "Nenhuma mensagem encontrada hoje neste grupo",
]

def _is_bot_summary(content: str) -> bool:
    if not content:
        return False
    return any(sig in content for sig in _BOT_SUMMARY_SIGNATURES)


def fetch_today_messages_from_inbox(account_id, api_key, inbox_id, group_name):
    """Coleta todas as mensagens de hoje de TODAS as conversas do inbox."""
    headers = {"api_access_token": api_key, "Content-Type": "application/json"}
    all_today = []
    contact_name = group_name

    with httpx.Client() as client:
        page = 1
        conv_ids = []
        while True:
            resp = client.get(
                f"{WISEAPP_API_URL}/v1/accounts/{account_id}/conversations",
                headers=headers,
                params={"inbox_id": inbox_id, "page": page, "status": "all"},
                timeout=30
            )
            if resp.status_code != 200:
                print(f"[DEBUG] Erro ao listar conversas do inbox {inbox_id} pagina {page}: {resp.status_code}")
                break
            data = resp.json()
            payload = data.get("data", {}) or data
            convs = payload.get("payload", [])
            if not convs:
                break
            for conv in convs:
                cid = conv.get("id")
                if cid:
                    conv_ids.append(cid)
                    name = (conv.get("meta") or {}).get("sender", {}).get("name", "")
                    if contact_name == group_name and name:
                        contact_name = name
            total = (payload.get("meta") or {}).get("all_count", 0)
            if page * 25 >= total or not convs:
                break
            page += 1

        print(f"[DEBUG] Conversas encontradas no inbox {inbox_id}: {conv_ids}")

        for conv_id in conv_ids:
            before_id = None
            for _page in range(10):
                params = {}
                if before_id:
                    params["before"] = before_id
                r = client.get(
                    f"{WISEAPP_API_URL}/v1/accounts/{account_id}/conversations/{conv_id}/messages",
                    headers=headers, params=params, timeout=60
                )
                if r.status_code != 200:
                    print(f"[DEBUG] Erro ao buscar mensagens conv {conv_id} pagina {_page+1}: {r.status_code}")
                    break
                batch = r.json().get("payload", [])
                if not batch:
                    break
                today_in_batch = [m for m in batch if is_message_from_today(m)]
                all_today.extend(today_in_batch)
                oldest = min(batch, key=lambda m: m.get("id", 0))
                if not is_message_from_today(oldest):
                    break
                before_id = oldest.get("id")

    return all_today, contact_name


@tool("Buscar Mensagens do Grupo")
def buscar_mensagens_grupo(group_name: str, account_id: str, api_key: str, limit: int = 80, inbox_id: str = None) -> str:
    """Busca as mensagens de um grupo WiseApp pelo inbox_id, filtrando apenas as de HOJE.
    
    Fluxo:
    1. Lista TODAS as conversas do inbox (incluindo resolvidas)
    2. Para cada conversa, busca mensagens de hoje
    3. Coleta e formata todas as mensagens de hoje de todas as conversas
    
    Args:
        group_name: Nome do grupo
        account_id: ID da conta WiseApp
        api_key: Token de API do WiseApp
        limit: Numero maximo de mensagens a retornar
        inbox_id: ID do inbox WiseApp (preferencial sobre busca por nome)
    Returns:
        Lista de mensagens do dia formatadas ou erro
    """
    try:
        if not inbox_id:
            return f"inbox_id nao informado. Nao e possivel buscar mensagens sem o inbox_id."

        messages, contact_name = fetch_today_messages_from_inbox(account_id, api_key, inbox_id, group_name)

        print(f"[DEBUG] Total de mensagens de hoje coletadas de todas as conversas: {len(messages)}")
        for m in messages:
            _ca = m.get("created_at")
            _mt = m.get("message_type")
            _priv = m.get("private")
            _sender = (m.get("sender") or {}).get("name", "?")
            _content_preview = str(m.get("content") or "")[:60]
            _today = is_message_from_today(m)
            print(f"[DEBUG] id={m.get('id')} type={_mt} private={_priv} today={_today} created_at={_ca} sender={_sender!r} content={_content_preview!r}")

        if not messages:
            return f"Nenhuma mensagem encontrada HOJE no grupo '{contact_name}'. O grupo existe mas nao teve atividade hoje."

        today_messages = []
        for msg in messages:
            content_raw = str(msg.get("content") or "")
            if _is_bot_summary(content_raw):
                print(f"[DEBUG] Ignorando resumo do bot id={msg.get('id')}: {content_raw[:80]!r}")
                continue

            msg_type = msg.get("message_type")
            if msg_type == 2:
                print(f"[DEBUG] Ignorando activity message id={msg.get('id')}")
                continue

            sender_info = msg.get("sender", {})
            sender_name = sender_info.get("name", "Desconhecido") if sender_info else "Desconhecido"

            if msg_type == 1:
                sender_name = "Atendente"

            content = content_raw
            content_type = msg.get("content_type", "text")

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

            created_at = msg.get("created_at", "")
            time_str = ""
            sort_ts = 0
            try:
                if isinstance(created_at, (int, float)):
                    msg_time = datetime.fromtimestamp(created_at, tz=timezone.utc)
                    sort_ts = created_at
                else:
                    msg_time = datetime.fromisoformat(created_at.replace('Z', '+00:00'))
                    sort_ts = msg_time.timestamp()
                msg_time_brasilia = msg_time.astimezone(BRASILIA_TZ)
                time_str = msg_time_brasilia.strftime("%H:%M")
            except Exception:
                pass

            today_messages.append({
                "sender": sender_name,
                "content": content,
                "time": time_str,
                "sort_ts": sort_ts
            })

        if not today_messages:
            return f"Nenhuma mensagem de usuarios encontrada HOJE no grupo '{contact_name}'. Mensagens do bot/sistema foram ignoradas."

        today_messages.sort(key=lambda m: m.get("sort_ts", 0))
        formatted = [f"MENSAGENS DO DIA - {contact_name}"]
        formatted.append(f"Data: {get_today_brasilia().strftime('%d/%m/%Y')}")
        formatted.append(f"Total de mensagens hoje: {len(today_messages)}")
        formatted.append("-" * 40)

        for msg in today_messages[-limit:]:
            time_prefix = f"[{msg['time']}] " if msg['time'] else ""
            formatted.append(f"{time_prefix}{msg['sender']}: {msg['content']}")

        return "\n".join(formatted)

    except Exception as e:
        return f"Erro ao buscar mensagens do grupo: {str(e)}"


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
                f"{WISEAPP_API_URL}/v1/accounts/{account_id}/conversations",
                headers=headers,
                params={"inbox_id": inbox_id, "status": "all"},
                timeout=30
            )

            if response.status_code != 200:
                return f"Erro ao buscar conversas: {response.text}"

            data = response.json()
            conversations = data.get("data", {}).get("payload", [])

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
