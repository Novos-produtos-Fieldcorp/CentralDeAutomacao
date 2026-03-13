from crewai import Crew, Task
from agents import create_group_summary_analyst, create_insights_analyst

def create_group_summary_crew(inbox_id: str, account_id: str, api_key: str, group_name: str):
    analyst = create_group_summary_analyst()
    
    summary_task = Task(
        description=f"""Você é um analista de dados especialista em extrair insights de conversas.
        Sua tarefa é gerar o resumo diário do grupo de WhatsApp "{group_name}".

        **PASSO 1: Coleta de Dados**
        Você DEVE OBRIGATORIAMENTE usar a ferramenta "Buscar Mensagens do Grupo" para ler o histórico.
        Parâmetros para a ferramenta:
        - group_name: {group_name}
        - account_id: {account_id}
        - api_key: {api_key}
        - inbox_id: {inbox_id}

        **PASSO 2: Triagem e Regras Absolutas**
        - Aguarde o retorno da ferramenta. Se ela retornar vazio ou falhar, assuma que há 0 mensagens.
        - IGNORE QUALQUER mensagem que seja um resumo passado (mensagens que contenham "Resumo do Grupo" ou "gerado automaticamente pela IAzinha").
        - Baseie-se APENAS no texto literal retornado pela ferramenta. NÃO alucine nem invente informações.
        - Analise o tom considerando que é um ambiente de trabalho informal.

        **PASSO 3: Geração do Resumo**
        Se a ferramenta retornou mensagens válidas (após a triagem), gere o output EXATAMENTE neste formato:

        Resumo do Grupo "{group_name}"
        • Quantidade de mensagens: [Número exato de mensagens analisadas]
        • O que foi discutido: [Resumo natural dos assuntos, citando as palavras-chave originais]
        • Tom geral: [Tranquilo / Ativo / Urgente / Neutro] - [Breve justificativa baseada nos textos]
        [INCLUA ESTA LINHA APENAS SE HOUVER PROBLEMAS EXPLICITOS: • Problemas/Pendências: [Descreva o problema real]]

        Este resumo foi gerado automaticamente pela IAzinha

        ---
        **REGRA DE EXCEÇÃO (FALLBACK)**
        Se após o Passo 1 e Passo 2 a quantidade de mensagens for ZERO, você DEVE ignorar o formato acima e retornar UNICAMENTE o texto abaixo:
        
        Resumo do Grupo "{group_name}"
        Nenhuma mensagem encontrada hoje neste grupo.
        Este resumo foi gerado automaticamente pela IAzinha
        """,
        expected_output=f"""Um texto em bullet points seguindo a formatação exata definida no PASSO 3, ou a mensagem de fallback caso não existam dados.""",
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
        description=f"""Você é um assistente encarregado de dar um panorama ultra-rápido do grupo "{group_name}".
        
        Use sua ferramenta de busca com os parâmetros: inbox_id={inbox_id}, account_id={account_id}, api_key={api_key}.
        
        Após ler as mensagens, escreva um resumo de no MÁXIMO 5 linhas focando apenas em:
        1. Volume de mensagens ativas hoje.
        2. Existência de urgências reais.
        3. Clima/Tom do grupo.
        
        Seja direto. Exemplo de tom desejado: "Grupo com 15 mensagens, clima tranquilo. Nenhuma urgência pendente."
        """,
        expected_output="""Texto corrido curto (máximo 5 linhas) ideal para leitura rápida no WhatsApp.""",
        agent=analyst
    )
    
    return Crew(
        agents=[analyst],
        tasks=[quick_task],
        verbose=True
    )