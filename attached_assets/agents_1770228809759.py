from crewai import Agent
from langchain_groq import ChatGroq
import os
from tools import (
    mover_conversa_kanban,
    criar_etiqueta,
    aplicar_etiqueta,
    fixar_conversa,
    buscar_mensagens,
    listar_etapas_kanban,
    listar_etiquetas
)

def get_groq_llm():
    return ChatGroq(
        model=os.getenv("GROQ_MODEL", "llama-3.1-70b-versatile"),
        api_key=os.getenv("GROQ_API_KEY"),
        temperature=0.3,
        max_tokens=2000
    )

def create_conversation_analyst():
    return Agent(
        role="Analista de Conversas",
        goal="Analisar conversas de WhatsApp e fornecer resumos, insights e sugestoes de resposta",
        backstory="""Voce e um especialista em analise de conversas de atendimento ao cliente.
        Voce consegue identificar o tom, sentimento, urgencia e principais topicos discutidos.
        Voce fornece resumos claros e objetivos, alem de sugestoes de respostas adequadas.""",
        tools=[buscar_mensagens],
        llm=get_groq_llm(),
        verbose=True,
        allow_delegation=False
    )


def create_workflow_manager():
    return Agent(
        role="Gerente de Workflow",
        goal="Gerenciar o fluxo de conversas no Kanban, movendo-as entre etapas conforme necessario",
        backstory="""Voce e um especialista em gestao de workflows e processos.
        Voce entende quando uma conversa deve ser movida para outra etapa do Kanban
        baseado no contexto da conversa e nas instrucoes do usuario.
        Voce conhece as etapas disponiveis e sabe qual e a mais adequada para cada situacao.""",
        tools=[mover_conversa_kanban, listar_etapas_kanban, fixar_conversa],
        llm=get_groq_llm(),
        verbose=True,
        allow_delegation=False
    )


def create_label_curator():
    return Agent(
        role="Curador de Etiquetas",
        goal="Gerenciar etiquetas, criando novas quando necessario e aplicando-as as conversas",
        backstory="""Voce e um especialista em organizacao e categorizacao.
        Voce sabe quando criar novas etiquetas e quando usar as existentes.
        Voce aplica etiquetas de forma consistente para manter a organizacao do sistema.""",
        tools=[criar_etiqueta, aplicar_etiqueta, listar_etiquetas],
        llm=get_groq_llm(),
        verbose=True,
        allow_delegation=False
    )


def create_reply_specialist():
    return Agent(
        role="Especialista em Respostas",
        goal="Sugerir respostas adequadas para conversas de atendimento ao cliente",
        backstory="""Voce e um especialista em comunicacao e atendimento ao cliente.
        Voce analisa o contexto da conversa e sugere respostas profissionais,
        empaticas e eficazes. Voce adapta o tom conforme o tipo de cliente e situacao.""",
        tools=[buscar_mensagens],
        llm=get_groq_llm(),
        verbose=True,
        allow_delegation=False
    )
