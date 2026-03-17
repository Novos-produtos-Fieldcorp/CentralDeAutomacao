return items.map(item => {
  const msg = item.json;
  let nomeExtraido = "Desconhecido";
  let textoExtraido = msg.content || "";
  let tipoFinal = "outros";
  let urlConteudo = "";

  if (msg.attachments && msg.attachments.length > 0) {
    const anexo = msg.attachments[0];
    urlConteudo = anexo.data_url || "";
    
    if (anexo.file_type === "image") {
      tipoFinal = "image";
    } else if (anexo.file_type === "audio") {
      tipoFinal = "audio";
    } else if (anexo.file_type === "file" || anexo.file_type === "plain") {
      tipoFinal = "file";
    } else {
      tipoFinal = "outros";
    }
  } else if (msg.content_type === "text" && textoExtraido !== "") {
    tipoFinal = "text";
  }

  // tenta extrair por markdown
  if (textoExtraido.includes(':**\n')) {
    const partes = textoExtraido.split(':**\n');
    nomeExtraido = partes[0].replace(/\*\*/g, '').trim();
    textoExtraido = (partes[1] || '').trim();
  } else if (textoExtraido.startsWith('**')) {
    nomeExtraido = textoExtraido.replace(/\*\*/g, '').replace(':', '').trim();
    textoExtraido = "";
  }

  // fallback: se ainda for Desconhecido e existir sender.name no JSON
  if (nomeExtraido === "Desconhecido" && msg.sender && msg.sender.name) {
    nomeExtraido = msg.sender.name;
  }

  if (["image", "audio", "file"].includes(tipoFinal) && urlConteudo !== "") {
    textoExtraido = textoExtraido !== "" ? `${textoExtraido} (Link: ${urlConteudo})` : urlConteudo;
  }

  const dataObjeto = new Date(msg.created_at * 1000);
  const dataFormatada = dataObjeto.toLocaleString('pt-BR', {
    timeZone: 'America/Sao_Paulo',
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  });

  return {
    json: {
      id: msg.id,
      nome_usuario: nomeExtraido,
      mensagem_texto: textoExtraido,
      tipo_mensagem: tipoFinal,
      data_envio: dataFormatada,
      url_original: urlConteudo
    }
  };
});
