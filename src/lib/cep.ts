import { apenasDigitos } from '@/lib/formato'

export interface EnderecoPorCep {
  endereco: string
  bairro: string
  cidade: string
  estado: string
}

/**
 * Busca endereço pelo CEP no ViaCEP.
 *
 * Serviço público, sem chave. Devolve `null` quando o CEP não existe ou
 * quando o serviço está fora do ar — o cadastro nunca deve travar por
 * causa disso, já que todos os campos de endereço podem ser digitados
 * à mão.
 */
export async function buscarEnderecoPorCep(cep: string): Promise<EnderecoPorCep | null> {
  const digitos = apenasDigitos(cep)
  if (digitos.length !== 8) return null

  try {
    const controlador = new AbortController()
    const limite = setTimeout(() => controlador.abort(), 8000)

    const resposta = await fetch(`https://viacep.com.br/ws/${digitos}/json/`, {
      signal: controlador.signal,
    })
    clearTimeout(limite)

    if (!resposta.ok) return null

    const dados = (await resposta.json()) as {
      erro?: boolean | string
      logradouro?: string
      bairro?: string
      localidade?: string
      uf?: string
    }

    // O ViaCEP responde 200 com { erro: true } para CEP inexistente.
    if (dados.erro) return null

    return {
      endereco: dados.logradouro ?? '',
      bairro: dados.bairro ?? '',
      cidade: dados.localidade ?? '',
      estado: dados.uf ?? '',
    }
  } catch {
    return null
  }
}
