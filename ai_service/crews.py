from crewai import Crew, Task
from agents import create_group_summary_analyst, create_insights_analyst


def create_group_summary_crew(inbox_id: str, account_id: str, api_key: str, group_name: str):
    analyst = create_group_summary_analyst()
    
    summary_task = Task(
        description=f"""Analise as conversas do grupo "{group_name}" e gere um resumo executivo.
        
        Use a ferramenta "Buscar Mensagens do Grupo" com os seguintes parametros:
        - group_name: {group_name}
        - account_id: {account_id}
        - api_key: {api_key}
        - inbox_id: {inbox_id}
        
        REGRAS ABSOLUTAS:
        1. Baseie seu resumo APENAS nas mensagens REAIS que voce encontrar
        2. NAO invente informacoes ou use textos genericos
        3. Trate as conversas como comunicacao NORMAL do dia a dia - nao force tom negativo
        4. Use as palavras EXATAS das mensagens ao descrever os assuntos
        5. O titulo DEVE ser exatamente: Resumo do Grupo "{group_name}"
        6. DEVE terminar com a frase: Este resumo foi gerado automaticamente pela IAzinha
        7. IGNORE COMPLETAMENTE qualquer mensagem que seja um resumo anterior gerado pela IAzinha ou pelo sistema — textos contendo "Resumo do Grupo", "gerado automaticamente pela IAzinha" ou "Nenhuma mensagem encontrada hoje" sao resumos antigos e NAO devem ser analisados nem citados
        
        O resumo deve seguir EXATAMENTE este formato:
        
        Resumo do Grupo "{group_name}"
        • Quantidade de mensagens: [numero]
        • O que foi discutido: [descricao natural dos assuntos, usando as palavras das mensagens]
        • Tom geral: [Tranquilo/Ativo/Urgente/Neutro - com breve justificativa baseada nas mensagens reais]
        [SOMENTE se houver problemas ou pendencias reais identificadas nas mensagens:]
        • Problemas/Pendencias: [cite os problemas concretos com as palavras usadas nas mensagens]
        
        Este resumo foi gerado automaticamente pela IAzinha
        
        IMPORTANTE: A secao "Problemas/Pendencias" deve aparecer SOMENTE se houver problemas ou pendencias reais nas mensagens. Se a conversa for normal/rotineira, NAO inclua essa secao.
        
        Se nao houver mensagens hoje, responda apenas:
        Resumo do Grupo "{group_name}"
        Nenhuma mensagem encontrada hoje neste grupo.
        Este resumo foi gerado automaticamente pela IAzinha""",
        expected_output=f"""FORMATO com bullet points:

Resumo do Grupo "{group_name}"
• Quantidade de mensagens: [numero]
• O que foi discutido: [descricao natural dos assuntos com palavras exatas]
• Tom geral: [classificacao com justificativa]
[apenas se houver problemas reais:]
• Problemas/Pendencias: [problemas concretos com palavras das mensagens]

Este resumo foi gerado automaticamente pela IAzinha""",
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
        description=f"""Gere um resumo rapido do grupo "{group_name}".
        
        Use os seguintes parametros:
        - inbox_id: {inbox_id}
        - account_id: {account_id}
        - api_key: {api_key}
        
        O resumo deve ser breve (maximo 5 linhas) e destacar apenas:
        1. Quantidade de conversas ativas
        2. Se ha algo urgente
        3. Tom geral do grupo""",
        expected_output="""Resumo curto em formato de mensagem para WhatsApp.""",
        agent=analyst
    )
    
    return Crew(
        agents=[analyst],
        tasks=[quick_task],
        verbose=True
    )
