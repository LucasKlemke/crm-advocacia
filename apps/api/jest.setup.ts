// Só os valores de ambiente que os testes do domínio precisam: o prefixo das chaves no S3,
// fixo no mesmo valor de .env.example que as asserções de storageKey usam ("development/…").
// Não carrega .env/.env.local de propósito: a suíte não pode depender de segredos reais
// nem da máquina (ou do shell) em que roda.
process.env.AWS_S3_PREFIX = "development";
