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
        
        O resumo deve conter:
        1. Visao geral do periodo (quantidade de conversas, status)
        2. Principais assuntos discutidos
        3. Problemas ou reclamacoes identificadas
        4. Solicitacoes pendentes ou urgentes
        5. Tom geral das conversas (positivo, neutro, negativo)
        
        Seja objetivo e direto. O resumo sera enviado para gestores.""",
        expected_output="""Um resumo executivo estruturado contendo:
        
        RESUMO DO GRUPO: [nome do grupo]
        
        Estatisticas:
        - Total de conversas: X
        - Abertas: X | Resolvidas: X | Pendentes: X
        
        Principais Assuntos:
        [lista dos principais topicos]
        
        Atencao Necessaria:
        [problemas ou urgencias identificadas]
        
        Observacoes:
        [insights relevantes]""",
        agent=analyst
    )
    
    insights_task = Task(
        description=f"""Com base nas informacoes do grupo "{group_name}", identifique insights importantes.
        
        Use os seguintes parametros:
        - inbox_id: {inbox_id}
        - account_id: {account_id}
        - api_key: {api_key}
        
        Foque em:
        1. Padroes de comportamento dos clientes
        2. Horarios de maior demanda
        3. Tipos de solicitacoes mais frequentes
        4. Oportunidades de melhoria no atendimento""",
        expected_output="""Insights formatados de forma clara e acionavel.""",
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
