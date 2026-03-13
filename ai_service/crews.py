from crewai import Crew, Task
from agents import create_group_summary_analyst, create_insights_analyst


def create_group_summary_crew(inbox_id: str, account_id: str, api_key: str, group_name: str):
    analyst = create_group_summary_analyst()
    
    summary_task = Task(
        description=f"""Voce e um analista de dados especialista em extrair insights de conversas.
        Sua tarefa e gerar o resumo diario do grupo de WhatsApp "{group_name}".

        **PASSO 1: Coleta de Dados**
        Voce DEVE OBRIGATORIAMENTE usar a ferramenta "Buscar Mensagens do Grupo" para ler o historico.
        Parametros para a ferramenta:
        - group_name: {group_name}
        - account_id: {account_id}
        - api_key: {api_key}
        - inbox_id: {inbox_id}

        **PASSO 2: Triagem e Regras Absolutas**
        - Aguarde o retorno da ferramenta. Se ela retornar vazio ou falhar, assuma que ha 0 mensagens.
        - IGNORE QUALQUER mensagem que seja um resumo passado (mensagens que contenham "Resumo do Grupo" ou "gerado automaticamente pela IAzinha").
        - Baseie-se APENAS no texto literal retornado pela ferramenta. NAO alucine nem invente informacoes.
        - Analise o tom considerando que e um ambiente de trabalho informal.
        - Use as palavras EXATAS das mensagens ao descrever os assuntos.

        **PASSO 3: Geracao do Resumo**
        Se a ferramenta retornou mensagens validas (apos a triagem), gere o output EXATAMENTE neste formato:

        Resumo do Grupo "{group_name}"
        • Quantidade de mensagens: [Numero exato de mensagens analisadas]
        • O que foi discutido: [Resumo natural dos assuntos, citando as palavras-chave originais]
        • Tom geral: [Tranquilo / Ativo / Urgente / Neutro] - [Breve justificativa baseada nos textos]
        [INCLUA ESTA LINHA APENAS SE HOUVER PROBLEMAS EXPLICITOS: • Problemas/Pendencias: [Descreva o problema real]]

        Este resumo foi gerado automaticamente pela IAzinha

        ---
        **REGRA DE EXCECAO (FALLBACK)**
        Se apos o Passo 1 e Passo 2 a quantidade de mensagens for ZERO, voce DEVE ignorar o formato acima e retornar UNICAMENTE o texto abaixo:

        Resumo do Grupo "{group_name}"
        Nenhuma mensagem encontrada hoje neste grupo.
        Este resumo foi gerado automaticamente pela IAzinha
        """,
        expected_output=f"""Um texto em bullet points seguindo a formatacao exata definida no PASSO 3, ou a mensagem de fallback caso nao existam dados.""",
        agent=analyst
    )
    
    return Crew(
        agents=[analyst],
        tasks=[summary_task],
        verbose=True
    )


def create_quick_summary_crew(inbox_id: str, account_id: str, api_key: str, group_name: str):
    analyst = create_group_summary_analyst()
    
    quick_task = Task(
        description=f"""Voce e um assistente encarregado de dar um panorama ultra-rapido do grupo "{group_name}".

        Use sua ferramenta de busca com os parametros: inbox_id={inbox_id}, account_id={account_id}, api_key={api_key}.

        Apos ler as mensagens, escreva um resumo de no MAXIMO 5 linhas focando apenas em:
        1. Volume de mensagens ativas hoje.
        2. Existencia de urgencias reais.
        3. Clima/Tom do grupo.

        Seja direto. Exemplo de tom desejado: "Grupo com 15 mensagens, clima tranquilo. Nenhuma urgencia pendente."
        """,
        expected_output="""Texto corrido curto (maximo 5 linhas) ideal para leitura rapida no WhatsApp.""",
        agent=analyst
    )
    
    return Crew(
        agents=[analyst],
        tasks=[quick_task],
        verbose=True
    )
