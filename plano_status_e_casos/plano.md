### 1. Status e tipo de status

Nas configurações de escritório, quero criar uma nova rota chamada **Status**. Nela, o usuário poderá gerenciar os status do seu pipeline, usando duas tabelas novas:

1. **Tipo de status**  
2. **Status**

O sistema já deve ter pré‑cadastrados os seguintes tipos de status:

1. Nova conversa  
2. Análise  
3. Qualificado  
4. Proposta  
5. Sucesso  
6. Perda  

Esses tipos de status deverão ser inseridos na tabela de tipo de status sempre que um novo banco for criado; eles servem para padronizar o funil de todos os escritórios.

Quanto aos status, o próprio escritório os definirá e os associará a um tipo de status, por exemplo:

- Escritório cria o status “Não interessado” e o associa ao tipo de status “Perda”.  
- Escritório cria o status “Reunião agendada” e o associa ao tipo de status “Proposta”.

A ideia é que, sempre que um escritório for criado, ele já venha com status básicos pré‑alimentados, pensando em um funil de clientes.

Cada registro de status e tipo de status também terá uma cor associada. O usuário deverá ter um CRUD de status, com os seguintes campos:
1. Ícone (ícone do Lucide Icons)  
2. Nome  
3. Tipo de status (associado à tabela de tipo de status (id))  
4. Cor  
5. Descrição (breve descrição daquele status)

Tipo de status também terá esses campos, porém nenhum usuário poderá editá‑los; eles servem apenas para associação, e a edição é responsabilidade do desenvolvedor administrador do sistema.

## 2. Casos

Em **/casos**, implementar a tela e a funcionalidade de casos. Será uma nova tabela no sistema, com associação aos membros do escritório e aos clientes.

- Um membro do escritório pode estar associado a diversos casos, mas cada caso tem apenas um responsável.  
- Um cliente pode estar associado a diversos casos, mas cada caso tem apenas um cliente.

Os casos também terão associação a status, já que podem avançar por vários estágios (funil). A interface oferecerá duas visualizações:

1. Kanban  
2. Tabela  

Cada caso terá comentários, iguais aos comentários de **/clientes**.

No cabeçalho haverá um filtro multi‑select para filtrar por:

- Responsável  
- Cliente  
- Status  
- Tipo de status  
- Data (período início/fim)

Cada status deverá incluir um campo (R$) que indique o valor do caso – quanto o advogado receberá ao concluí‑‑lo.

Também serão necessários os seguintes campos:

- Data de criação  
- Data de atualização  

Deve haver botão “Novo caso” para registrar um novo caso.  
Ao clicar em um card do kanban, deve abrir uma drawer lateral com as informações do caso (semelhante a /clientes). Lá, o usuário deverá conseguir ver todas as informações, editá‑‑‑las e arquivar o caso.

Na visualização de tabela, o acesso a essa drawer será através de um botão de ação (primeira coluna). Na coluna de status da visualização de tabela, deverá ser um select onde o usuário poderá alterar o status do lead.

Lembre‑‑se:  
- visualização de tabela deverá ter paginação no backend  
- visualização kanban, scroll infinito  
- em ambas, a filtragem deverá ser aplicada via backend também.


