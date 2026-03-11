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
        3. Use SEMPRE as palavras EXATAS das mensagens - nunca generalize. Se a mensagem diz "entrega atrasada", escreva "entrega atrasada". Se diz "motorista nao apareceu", escreva "motorista nao apareceu"
        4. Para grupos com poucas mensagens ou informacoes incompletas, liste o que ainda precisa ser verificado
        5. O titulo DEVE ser exatamente: Resumo do Grupo "{group_name}"
        6. DEVE terminar com a frase: Este resumo foi gerado automaticamente pela IAzinha
        
        O resumo deve seguir EXATAMENTE este formato com bullet points:
        
        Resumo do Grupo "{group_name}"
        • Quantidade de mensagens: [numero]
        • Principais assuntos: [topicos ESPECIFICOS usando as proprias palavras das mensagens]
        • Problemas/Pendencias: [problemas CONCRETOS citados com as palavras usadas, ou "Nenhum problema identificado"]
        • Tom geral: [Urgente/Tranquilo/Insatisfeito/Satisfeito/Neutro - com breve justificativa]
        • Informacoes sugeridas: [liste o que o grupo ainda precisa definir ou verificar para resolver pendencias abertas - se tudo estiver resolvido, escreva "Nenhuma"]
        
        Este resumo foi gerado automaticamente pela IAzinha
        
        Se nao houver mensagens hoje, responda apenas:
        Resumo do Grupo "{group_name}"
        Nenhuma mensagem encontrada hoje neste grupo.
        Este resumo foi gerado automaticamente pela IAzinha""",
        expected_output=f"""FORMATO OBRIGATORIO com bullet points:

Resumo do Grupo "{group_name}"
• Quantidade de mensagens: [numero]
• Principais assuntos: [topicos especificos com palavras exatas das mensagens]
• Problemas/Pendencias: [problemas concretos ou "Nenhum problema identificado"]
• Tom geral: [classificacao com justificativa]
• Informacoes sugeridas: [perguntas/verificacoes pendentes ou "Nenhuma"]

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
