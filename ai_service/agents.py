from crewai import Agent
from langchain_groq import ChatGroq
import os
from tools import buscar_mensagens_inbox, buscar_conversas_recentes


def get_groq_llm():
    return ChatGroq(
        model=os.getenv("GROQ_MODEL", "llama-3.1-70b-versatile"),
        api_key=os.getenv("GROQ_API_KEY"),
        temperature=0.3,
        max_tokens=2000
    )


def create_group_summary_analyst():
    return Agent(
        role="Analista de Resumo de Grupo",
        goal="Analisar conversas de um grupo/inbox de WhatsApp e gerar um resumo executivo claro e objetivo",
        backstory="""Voce e um especialista em analise de conversas de atendimento ao cliente.
        Voce consegue identificar os principais topicos discutidos, problemas recorrentes,
        solicitacoes pendentes e o tom geral das conversas.
        Voce fornece resumos claros, objetivos e acionaveis para gestores.""",
        tools=[buscar_mensagens_inbox, buscar_conversas_recentes],
        llm=get_groq_llm(),
        verbose=True,
        allow_delegation=False
    )


def create_insights_analyst():
    return Agent(
        role="Analista de Insights",
        goal="Extrair insights e metricas das conversas analisadas",
        backstory="""Voce e um especialista em analise de dados de atendimento.
        Voce identifica padroes, tendencias e oportunidades de melhoria
        baseado nas conversas analisadas. Voce apresenta os dados de forma
        clara e quantificada quando possivel.""",
        tools=[buscar_conversas_recentes],
        llm=get_groq_llm(),
        verbose=True,
        allow_delegation=False
    )
