import type { Express } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";

export async function registerRoutes(app: Express): Promise<Server> {
  // put application routes here
  // prefix all routes with /api

  // use storage to perform CRUD operations on the storage interface
  // e.g. storage.insertUser(user) or storage.getUserByUsername(username)

  // Proxy para consulta de CEP com múltiplas APIs de fallback
  app.get('/api/cep/:cep', async (req, res) => {
    try {
      const { cep } = req.params;
      
      // Validar formato do CEP
      if (!/^\d{8}$/.test(cep)) {
        return res.status(400).json({ error: 'CEP deve conter exatamente 8 dígitos' });
      }

      // Lista de APIs de CEP para fallback
      const cepApis = [
        {
          name: 'ViaCEP',
          url: `https://viacep.com.br/ws/${cep}/json/`,
          timeout: 8000,
          transform: (data: any) => ({
            cep: data.cep,
            logradouro: data.logradouro,
            complemento: data.complemento,
            bairro: data.bairro,
            localidade: data.localidade,
            uf: data.uf,
            ibge: data.ibge,
            gia: data.gia,
            ddd: data.ddd,
            siafi: data.siafi
          }),
          isError: (data: any) => data.erro
        },
        {
          name: 'BrasilAPI',
          url: `https://brasilapi.com.br/api/cep/v1/${cep}`,
          timeout: 6000,
          transform: (data: any) => ({
            cep: data.cep,
            logradouro: data.street,
            complemento: '',
            bairro: data.neighborhood,
            localidade: data.city,
            uf: data.state,
            ibge: '',
            gia: '',
            ddd: '',
            siafi: ''
          }),
          isError: (data: any) => !data.cep || data.type === 'error'
        },
        {
          name: 'PostMon',
          url: `https://api.postmon.com.br/v1/cep/${cep}`,
          timeout: 6000,
          transform: (data: any) => ({
            cep: data.cep,
            logradouro: data.logradouro,
            complemento: data.complemento || '',
            bairro: data.bairro,
            localidade: data.cidade,
            uf: data.estado,
            ibge: data.cidade_info?.codigo_ibge || '',
            gia: '',
            ddd: '',
            siafi: ''
          }),
          isError: (data: any) => !data.cep
        },
        {
          name: 'RepublicaVirtual',
          url: `https://cep.republicavirtual.com.br/web_cep.php?cep=${cep}&formato=json`,
          timeout: 6000,
          transform: (data: any) => ({
            cep: cep,
            logradouro: data.tipo_logradouro + ' ' + data.logradouro,
            complemento: '',
            bairro: data.bairro,
            localidade: data.cidade,
            uf: data.uf,
            ibge: '',
            gia: '',
            ddd: '',
            siafi: ''
          }),
          isError: (data: any) => data.resultado !== '1'
        }
      ];

      let lastError = null;

      // Tentar cada API em sequência
      for (const api of cepApis) {
        try {
          console.log(`Tentando API ${api.name} para CEP ${cep}`);
          
          const controller = new AbortController();
          const timeoutId = setTimeout(() => controller.abort(), api.timeout || 5000);
          
          const fetchOptions: any = {
            method: 'GET',
            signal: controller.signal,
            headers: {
              'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
              'Accept': 'application/json, text/plain, */*',
              'Accept-Language': 'pt-BR,pt;q=0.9,en;q=0.8',
              'Cache-Control': 'no-cache',
              ...api.headers
            }
          };

          const response = await fetch(api.url, fetchOptions);
          clearTimeout(timeoutId);
          
          if (!response.ok) {
            throw new Error(`${api.name} retornou status ${response.status}`);
          }

          const data = await response.json();
          
          if (api.isError && api.isError(data)) {
            throw new Error(`CEP não encontrado na API ${api.name}`);
          }

          const transformedData = api.transform(data);
          console.log(`✓ CEP encontrado com sucesso via ${api.name}`);
          
          return res.json(transformedData);
        } catch (error) {
          console.warn(`Erro na API ${api.name}:`, error instanceof Error ? error.message : error);
          lastError = error;
          continue;
        }
      }

      // Se chegou aqui, todas as APIs falharam
      console.error('Todas as APIs de CEP falharam:', lastError);
      const errorMessage = lastError?.message || '';
      console.log('Última mensagem de erro:', errorMessage);
      
      // Verifica se o problema é indisponibilidade geral ou CEP inválido
      const isGeneralFailure = lastError && (
        errorMessage.includes('status 5') || 
        errorMessage.includes('fetch failed') ||
        errorMessage.includes('timeout') ||
        errorMessage.includes('502') ||
        errorMessage.includes('503') ||
        errorMessage.includes('401') ||
        errorMessage.includes('aborted') ||
        errorMessage.includes('retornou status')
      );
      
      console.log('É falha geral?', isGeneralFailure);
      
      if (isGeneralFailure) {
        res.status(503).json({ 
          error: 'Serviços de CEP temporariamente indisponíveis. Todas as APIs estão fora do ar no momento.',
          details: 'Preencha o endereço manualmente ou tente novamente em alguns minutos.'
        });
      } else {
        res.status(404).json({ 
          error: 'CEP não encontrado em nenhuma API disponível',
          details: 'Tente novamente em alguns instantes ou verifique se o CEP está correto'
        });
      }
    } catch (error) {
      console.error('Erro geral ao consultar CEP:', error);
      res.status(500).json({ 
        error: 'Erro interno do servidor ao consultar CEP',
        details: error instanceof Error ? error.message : 'Erro desconhecido'
      });
    }
  });

  const httpServer = createServer(app);

  return httpServer;
}
