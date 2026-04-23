import type { Express } from "express";

interface CpfApiResponse {
  CadastroPessoaFisica?: {
    Nome?: string;
    DataNascimento?: string;
    Telefones?: Array<{ TelefoneComDDD: string }>;
    Enderecos?: Array<{
      Logradouro?: string;
      Numero?: string;
      Complemento?: string;
      Bairro?: string;
      Cidade?: string;
      UF?: string;
      CEP?: string;
    }>;
  };
  ReceitaFederalCpf?: {
    NomePessoaFisica?: string;
    DataNascimento?: string;
  };
}

interface CpfData {
  nome?: string;
  dt_nascimento?: string;
  telefone?: string;
  logradouro?: string;
  numero?: string;
  complemento?: string;
  bairro?: string;
  cidade?: string;
  estado?: string;
  cep?: string;
}

export function registerCpfRoute(app: Express): void {
  app.get("/api/cpf/:cpf", async (req, res) => {
    try {
      const { cpf } = req.params;

      if (!/^\d{11}$/.test(cpf)) {
        return res.status(400).json({ error: "CPF deve conter exatamente 11 dígitos" });
      }

      console.log(`Consultando CPF via proxy: ${cpf}`);

      const hubToken = process.env.HUB_CPF_TOKEN;

      const APIS = [
        ...(hubToken ? [{
          name: 'HubDoDesenvolvedor',
          url: `https://ws.hubdodesenvolvedor.com.br/v2/cadastropf/?cpf=${cpf}&token=${hubToken}`,
          headers: { 'Accept': 'application/json' },
        }] : []),
        {
          name: 'BrazilAPI',
          url: `https://brasilapi.com.br/api/cpf/v1/${cpf}`,
          headers: { 'Accept': 'application/json' },
        },
        {
          name: 'ReceitaWS',
          url: `https://www.receitaws.com.br/v1/cpf/${cpf}`,
          headers: { 'Accept': 'application/json' },
        },
      ];

      // Hub /v2/cadastropf/ response: { return: "OK", result: { nomeCompleto, dataDeNascimento (DD/MM/YYYY), listaTelefones, listaEnderecos, listaEmails } }
      const processHubResponse = (apiResponse: any): CpfData => {
        if (apiResponse.return !== 'OK' || !apiResponse.result) return {};

        const r = apiResponse.result;

        let dt_nascimento: string | undefined;
        if (r.dataDeNascimento) {
          const parts = r.dataDeNascimento.split('/');
          if (parts.length === 3) {
            dt_nascimento = `${parts[2]}-${parts[1]}-${parts[0]}`;
          }
        }

        const telefone = r.listaTelefones?.[0]?.telefoneComDDD?.replace(/\D/g, '') || undefined;

        const endereco = r.listaEnderecos?.[0];

        return {
          nome: r.nomeCompleto || undefined,
          dt_nascimento,
          telefone,
          logradouro: endereco?.logradouro || undefined,
          numero: endereco?.numero || undefined,
          complemento: endereco?.complemento || undefined,
          bairro: endereco?.bairro || undefined,
          cidade: endereco?.cidade || undefined,
          estado: endereco?.uf || undefined,
          cep: endereco?.cep?.replace(/\D/g, '') || undefined,
        };
      };

      const processGenericResponse = (apiResponse: any): CpfData => ({
        nome: apiResponse.name || apiResponse.nome || undefined,
        dt_nascimento: apiResponse.birth_date || apiResponse.data_nascimento || apiResponse.dt_nascimento || undefined,
        telefone: apiResponse.phone || apiResponse.telefone || undefined,
        logradouro: apiResponse.address || apiResponse.logradouro || undefined,
        numero: apiResponse.number || apiResponse.numero || undefined,
        bairro: apiResponse.district || apiResponse.bairro || undefined,
        cidade: apiResponse.city || apiResponse.cidade || undefined,
        estado: apiResponse.state || apiResponse.uf || apiResponse.estado || undefined,
        cep: apiResponse.zipcode || apiResponse.cep || undefined,
      });

      let result: CpfData | null = null;

      for (const api of APIS) {
        try {
          console.log(`🔄 Tentando ${api.name}...`);

          const controller = new AbortController();
          const timeoutId = setTimeout(() => controller.abort(), 8000);

          const response = await fetch(api.url, {
            method: 'GET',
            headers: api.headers,
            signal: controller.signal,
          });

          clearTimeout(timeoutId);

          if (!response.ok) {
            throw new Error(`HTTP ${response.status}: ${response.statusText}`);
          }

          const apiResponse = await response.json();

          result = api.name === 'HubDoDesenvolvedor'
            ? processHubResponse(apiResponse)
            : processGenericResponse(apiResponse);

          if (result && (result.nome || result.telefone)) {
            console.log(`✅ CPF ${cpf} consultado via ${api.name} com sucesso!`);
            break;
          } else {
            console.log(`⚠️ ${api.name} retornou resposta vazia`);
            result = null;
          }

        } catch (apiError) {
          console.log(`❌ ${api.name} falhou: ${apiError.message}`);
          continue;
        }
      }

      if (!result) {
        console.log(`⚠️ CPF ${cpf}: nenhuma API retornou dados.`);
        return res.json({});
      }

      res.json(result);

    } catch (error) {
      console.error('Erro ao consultar CPF:', error);

      const errorMessage = error instanceof Error ? error.message : 'Erro inesperado ao consultar CPF';

      if (errorMessage.includes('aborted') || errorMessage.includes('timeout')) {
        res.status(408).json({
          error: 'Timeout: A consulta demorou muito para responder',
          details: 'Tente novamente em alguns instantes',
        });
      } else if (errorMessage.includes('Failed to fetch') || errorMessage.includes('fetch failed')) {
        res.status(503).json({
          error: 'Serviço de consulta CPF temporariamente indisponível',
          details: 'Tente novamente em alguns minutos ou preencha os dados manualmente',
        });
      } else {
        res.status(500).json({
          error: errorMessage,
          details: 'Erro ao consultar dados do CPF',
        });
      }
    }
  });
}
