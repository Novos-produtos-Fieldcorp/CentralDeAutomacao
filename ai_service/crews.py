from crewai import Crew, Task
from agents import create_group_summary_analyst, create_insights_analyst


def create_group_summary_crew(inbox_id: str, account_id: str, api_key: str, group_name: str):
    analyst = create_group_summary_analyst()
    insights = create_insights_analyst()
    
    summary_task = Task(
        description=f"""Analise as conversas do grupo "{group_name}" (inbox_id: {inbox_id}) e gere um resumo executivo.
        
        Use os seguintes parametros para buscar as mensagens:
        - inbox_id: {inbox_id}
        - account_id: {account_id}
        - api_key: {api_key}
        
        REGRA IMPORTANTE: Baseie seu resumo APENAS nas mensagens REAIS que voce encontrar.
        NAO invente informacoes. NAO use textos genericos como "suporte tecnico", "duvidas sobre produtos" se nao estiverem nas mensagens.
        
        O resumo deve conter:
        1. Quantidade de mensagens encontradas hoje
        2. Principais assuntos ESPECIFICOS discutidos (cite nomes, termos, temas das mensagens reais)
        3. Problemas ou reclamacoes ESPECIFICAS identificadas nas mensagens
        4. Solicitacoes pendentes ou urgentes mencionadas
        5. Tom geral das conversas baseado no conteudo real
        
        Se nao houver mensagens hoje, diga claramente "Nenhuma mensagem encontrada hoje neste grupo."
        
        Seja objetivo e direto. Use dados REAIS das mensagens.""",
        expected_output="""Um resumo executivo baseado nas mensagens REAIS, contendo:
        
        RESUMO DO DIA - [nome do grupo]
        
        Mensagens: X mensagens analisadas
        
        Assuntos Discutidos:
        [lista dos topicos REAIS mencionados nas mensagens]
        
        Pontos de Atencao:
        [problemas ou urgencias REAIS identificadas]
        
        Observacoes:
        [insights baseados no conteudo real]""",
        agent=analyst
    )
    
    insights_task = Task(
        description=f"""Com base nas mensagens REAIS do grupo "{group_name}", extraia insights ESPECIFICOS do que foi discutido.
        
        Use os seguintes parametros:
        - inbox_id: {inbox_id}
        - account_id: {account_id}
        - api_key: {api_key}
        
        IMPORTANTE: Analise APENAS o conteudo REAL das mensagens. NAO use textos genericos ou exemplos.
        
        Para cada topico abaixo, extraia informacoes CONCRETAS das conversas:
        
        1. Comportamento observado: Descreva especificamente como os participantes se comportaram nas conversas de hoje (tom, urgencia, tipos de perguntas feitas)
        
        2. Horarios de atividade: Mencione os horarios em que houve mais mensagens baseado nos timestamps reais das conversas
        
        3. Assuntos discutidos: Liste os topicos ESPECIFICOS mencionados nas conversas (nomes de produtos, servicos, problemas concretos, etc)
        
        4. Acoes recomendadas: Sugira acoes ESPECIFICAS baseadas nos problemas ou solicitacoes reais identificadas nas mensagens
        
        Se nao houver informacao suficiente para algum topico, diga "Sem dados suficientes para este periodo" em vez de inventar informacoes genericas.""",
        expected_output="""Insights ESPECIFICOS extraidos das conversas reais, sem textos genericos ou exemplos inventados.""",
        agent=insights,
        context=[summary_task]
    )
    
    return Crew(
        agents=[analyst, insights],
        tasks=[summary_task, insights_task],
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
