from crewai import Crew, Task
from agents import (
    create_conversation_analyst,
    create_workflow_manager,
    create_label_curator,
    create_reply_specialist
)


def create_summary_crew(conversation_id: str):
    analyst = create_conversation_analyst()
    
    summary_task = Task(
        description=f"""Analise a conversa com ID {conversation_id} e forneca:
        1. Um resumo conciso (maximo 3 frases) do que foi discutido
        2. O sentimento geral do cliente (positivo, neutro, negativo)
        3. Os principais topicos abordados
        4. Se ha alguma pendencia ou acao necessaria
        
        Use a ferramenta 'Buscar Mensagens da Conversa' para obter as mensagens.""",
        expected_output="""Um resumo estruturado contendo:
        - Resumo: [texto do resumo]
        - Sentimento: [positivo/neutro/negativo]
        - Topicos: [lista de topicos]
        - Pendencias: [lista de pendencias ou 'Nenhuma']""",
        agent=analyst
    )
    
    return Crew(
        agents=[analyst],
        tasks=[summary_task],
        verbose=True
    )


def create_kanban_crew(conversation_id: str, instruction: str):
    manager = create_workflow_manager()
    
    kanban_task = Task(
        description=f"""Execute a seguinte instrucao para a conversa {conversation_id}:
        
        Instrucao do usuario: {instruction}
        
        Primeiro, liste as etapas disponiveis no Kanban usando a ferramenta apropriada.
        Depois, identifique qual etapa corresponde a instrucao do usuario.
        Por fim, mova a conversa para a etapa correta.
        
        Se a instrucao pedir para fixar a conversa, use a ferramenta de fixar.""",
        expected_output="Confirmacao da acao executada com sucesso ou explicacao do erro.",
        agent=manager
    )
    
    return Crew(
        agents=[manager],
        tasks=[kanban_task],
        verbose=True
    )


def create_label_crew(conversation_id: str, instruction: str):
    curator = create_label_curator()
    
    label_task = Task(
        description=f"""Execute a seguinte instrucao de etiquetas para a conversa {conversation_id}:
        
        Instrucao do usuario: {instruction}
        
        Primeiro, liste as etiquetas disponiveis.
        Se a instrucao pedir para criar uma nova etiqueta, crie-a com um nome e cor adequados.
        Se a instrucao pedir para aplicar uma etiqueta existente, aplique-a.
        
        Seja inteligente ao escolher cores para novas etiquetas:
        - Urgente/Importante: vermelho (#FF4444)
        - Sucesso/Resolvido: verde (#44FF44)
        - Pendente/Aguardando: amarelo (#FFAA00)
        - Informativo: azul (#4444FF)
        - Neutro: cinza (#888888)""",
        expected_output="Confirmacao da acao executada com sucesso.",
        agent=curator
    )
    
    return Crew(
        agents=[curator],
        tasks=[label_task],
        verbose=True
    )


def create_reply_crew(conversation_id: str, context: str = None):
    specialist = create_reply_specialist()
    
    context_text = f"\nContexto adicional: {context}" if context else ""
    
    reply_task = Task(
        description=f"""Analise a conversa {conversation_id} e sugira uma resposta adequada.{context_text}
        
        Primeiro, busque as mensagens da conversa para entender o contexto.
        Depois, sugira 2-3 opcoes de resposta:
        1. Uma resposta formal e profissional
        2. Uma resposta mais amigavel e proxima
        3. Uma resposta curta e objetiva (se aplicavel)
        
        Considere o tom da conversa e adapte suas sugestoes.""",
        expected_output="""Sugestoes de resposta formatadas como:
        
        **Opcao 1 (Formal):**
        [texto da resposta]
        
        **Opcao 2 (Amigavel):**
        [texto da resposta]
        
        **Opcao 3 (Objetiva):**
        [texto da resposta]""",
        agent=specialist
    )
    
    return Crew(
        agents=[specialist],
        tasks=[reply_task],
        verbose=True
    )


def create_general_crew(conversation_id: str, instruction: str):
    analyst = create_conversation_analyst()
    manager = create_workflow_manager()
    curator = create_label_curator()
    
    general_task = Task(
        description=f"""Execute a seguinte instrucao para a conversa {conversation_id}:
        
        Instrucao: {instruction}
        
        Analise a instrucao e determine qual acao tomar:
        - Se for sobre mover no Kanban, use as ferramentas de workflow
        - Se for sobre etiquetas, use as ferramentas de etiquetas
        - Se for sobre resumo ou analise, busque e analise as mensagens
        - Se for sobre fixar, use a ferramenta de fixar conversa
        
        Execute a acao mais apropriada baseada na instrucao.""",
        expected_output="Resultado da acao executada.",
        agent=manager
    )
    
    return Crew(
        agents=[analyst, manager, curator],
        tasks=[general_task],
        verbose=True
    )
