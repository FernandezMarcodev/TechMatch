/** Area of a catalog skill, for the trends dashboard ("Tecnologías por área"). */
export type SkillArea =
  'LANGUAGES' | 'FRONTEND' | 'BACKEND' | 'DATA' | 'CLOUD_DEVOPS' | 'PRACTICES';

/**
 * Alias dictionary for technical skills (docs/03-MATCHING-SPEC.md § Skills).
 * `name` is the canonical display name; aliases are matched case-insensitively
 * unless `caseSensitive` is set (for short terms that collide with common words).
 */
export interface SkillDefinition {
  readonly name: string;
  readonly aliases: readonly string[];
  readonly caseSensitive?: boolean;
  readonly area: SkillArea;
}

type Entry = Omit<SkillDefinition, 'area'>;
const inArea = (area: SkillArea, entries: readonly Entry[]): SkillDefinition[] =>
  entries.map((entry) => ({ ...entry, area }));

export const SKILL_CATALOG: readonly SkillDefinition[] = [
  ...inArea('LANGUAGES', [
    { name: 'JavaScript', aliases: ['javascript', 'js', 'ecmascript', 'es6'] },
    { name: 'TypeScript', aliases: ['typescript', 'ts'] },
    { name: 'Java', aliases: ['java'] },
    { name: 'Python', aliases: ['python', 'python3'] },
    { name: 'C#', aliases: ['c#', 'csharp', 'c sharp'] },
    { name: 'C++', aliases: ['c++', 'cpp'] },
    { name: 'Go', aliases: ['golang'] },
    { name: 'Go', aliases: ['Go'], caseSensitive: true },
    { name: 'PHP', aliases: ['php'] },
    { name: 'Ruby', aliases: ['ruby'] },
    { name: 'Kotlin', aliases: ['kotlin'] },
    { name: 'Swift', aliases: ['swift'] },
    { name: 'Scala', aliases: ['scala'] },
    { name: 'Rust', aliases: ['rust'] },
    { name: 'Dart', aliases: ['dart'] },
    { name: 'COBOL', aliases: ['cobol'] },
    { name: 'ABAP', aliases: ['abap'] },
    { name: 'Visual Basic', aliases: ['visual basic', 'vb.net', 'vba'] },
    { name: 'Bash', aliases: ['bash', 'shell scripting'] },
    { name: 'PowerShell', aliases: ['powershell'] },
    { name: 'HTML', aliases: ['html', 'html5'] },
    { name: 'CSS', aliases: ['css', 'css3'] },
    { name: 'Sass', aliases: ['sass', 'scss'] },
    { name: 'SQL', aliases: ['sql', 't-sql', 'tsql', 'pl/sql', 'plsql'] },
  ]),
  ...inArea('FRONTEND', [
    { name: 'React', aliases: ['react', 'react.js', 'reactjs'] },
    { name: 'React Native', aliases: ['react native'] },
    { name: 'Angular', aliases: ['angular', 'angularjs', 'angular.js'] },
    { name: 'Vue.js', aliases: ['vue', 'vue.js', 'vuejs'] },
    { name: 'Next.js', aliases: ['next.js', 'nextjs'] },
    { name: 'Redux', aliases: ['redux'] },
    { name: 'jQuery', aliases: ['jquery'] },
    { name: 'Bootstrap', aliases: ['bootstrap'] },
    { name: 'Tailwind CSS', aliases: ['tailwind', 'tailwindcss', 'tailwind css'] },
    { name: 'Flutter', aliases: ['flutter'] },
  ]),
  ...inArea('BACKEND', [
    { name: 'Node.js', aliases: ['node', 'node.js', 'nodejs'] },
    { name: 'Express', aliases: ['express.js', 'expressjs'] },
    { name: 'Express', aliases: ['Express'], caseSensitive: true },
    { name: 'NestJS', aliases: ['nestjs', 'nest.js'] },
    { name: 'Spring', aliases: ['spring', 'spring framework'] },
    { name: 'Spring Boot', aliases: ['spring boot', 'springboot'] },
    { name: 'Hibernate', aliases: ['hibernate', 'jpa'] },
    { name: 'Quarkus', aliases: ['quarkus'] },
    { name: 'Entity Framework', aliases: ['entity framework', 'entity framework core', 'ef core'] },
    { name: 'Dapper', aliases: ['dapper'] },
    {
      name: '.NET',
      aliases: ['.net', 'dotnet', '.net core', 'asp.net', 'asp.net core', 'net core'],
    },
    { name: 'Django', aliases: ['django'] },
    { name: 'Flask', aliases: ['flask'] },
    { name: 'FastAPI', aliases: ['fastapi'] },
    { name: 'Laravel', aliases: ['laravel'] },
    { name: 'Symfony', aliases: ['symfony'] },
    { name: 'Ruby on Rails', aliases: ['ruby on rails', 'rails'] },
    { name: 'GraphQL', aliases: ['graphql'] },
    {
      name: 'REST',
      aliases: [
        'rest',
        'restful',
        'api rest',
        'apis rest',
        'rest api',
        'rest apis',
        'restful api',
        'restful apis',
        'api restful',
        'apis restful',
        'rest api design',
      ],
    },
    { name: 'SOAP', aliases: ['soap'] },
    { name: 'JWT', aliases: ['jwt', 'json web token', 'json web tokens'] },
    { name: 'OAuth', aliases: ['oauth', 'oauth2', 'oauth 2.0'] },
    {
      name: 'Event-Driven Architecture',
      aliases: [
        'event-driven architecture',
        'event driven architecture',
        'arquitectura orientada a eventos',
      ],
    },
    { name: 'Microservices', aliases: ['microservicios', 'microservices', 'microservicio'] },
  ]),
  ...inArea('DATA', [
    { name: 'PostgreSQL', aliases: ['postgresql', 'postgres'] },
    { name: 'MySQL', aliases: ['mysql'] },
    { name: 'SQL Server', aliases: ['sql server', 'sqlserver', 'mssql'] },
    { name: 'Oracle', aliases: ['oracle', 'oracle database'] },
    { name: 'DB2', aliases: ['db2'] },
    { name: 'MongoDB', aliases: ['mongodb', 'mongo'] },
    { name: 'DynamoDB', aliases: ['dynamodb', 'dynamo db'] },
    { name: 'NoSQL', aliases: ['nosql'] },
    {
      name: 'Stored Procedures',
      aliases: ['stored procedures', 'stored procedure', 'procedimientos almacenados'],
    },
    { name: 'Redis', aliases: ['redis'] },
    { name: 'Elasticsearch', aliases: ['elasticsearch', 'elastic search'] },
    { name: 'Kafka', aliases: ['kafka'] },
    { name: 'RabbitMQ', aliases: ['rabbitmq'] },
    { name: 'Spark', aliases: ['spark', 'pyspark'] },
    { name: 'Pandas', aliases: ['pandas'] },
    { name: 'Power BI', aliases: ['power bi', 'powerbi'] },
    { name: 'Tableau', aliases: ['tableau'] },
    { name: 'Excel', aliases: ['excel'] },
    { name: 'Machine Learning', aliases: ['machine learning', 'aprendizaje automatico'] },
    { name: 'TensorFlow', aliases: ['tensorflow'] },
    { name: 'PyTorch', aliases: ['pytorch'] },
  ]),
  ...inArea('CLOUD_DEVOPS', [
    { name: 'AWS', aliases: ['aws', 'amazon web services'] },
    { name: 'AWS Lambda', aliases: ['aws lambda'] },
    { name: 'Serverless', aliases: ['serverless', 'serverless architecture'] },
    { name: 'Azure', aliases: ['azure'] },
    { name: 'GCP', aliases: ['gcp', 'google cloud', 'google cloud platform'] },
    { name: 'Docker', aliases: ['docker'] },
    { name: 'Kubernetes', aliases: ['kubernetes', 'k8s'] },
    { name: 'Terraform', aliases: ['terraform'] },
    { name: 'Jenkins', aliases: ['jenkins'] },
    { name: 'CI/CD', aliases: ['ci/cd', 'cicd'] },
    { name: 'GitHub Actions', aliases: ['github actions'] },
    { name: 'DevOps', aliases: ['devops'] },
    { name: 'Git', aliases: ['git', 'github', 'gitlab', 'bitbucket'] },
    { name: 'Linux', aliases: ['linux', 'unix'] },
  ]),
  ...inArea('PRACTICES', [
    { name: 'Scrum', aliases: ['scrum'] },
    { name: 'Agile', aliases: ['agile', 'metodologias agiles', 'metodologia agil'] },
    { name: 'Jira', aliases: ['jira'] },
    { name: 'Selenium', aliases: ['selenium'] },
    { name: 'Cypress', aliases: ['cypress'] },
    { name: 'Jest', aliases: ['jest'] },
    {
      name: 'Unit Testing',
      aliases: [
        'unit testing',
        'unit tests',
        'pruebas unitarias',
        'prueba unitaria',
        'tests unitarios',
        'test unitarios',
        'testing unitario',
      ],
    },
    {
      name: 'Integration Testing',
      aliases: [
        'integration testing',
        'integration tests',
        'pruebas de integracion',
        'tests de integracion',
      ],
    },
    { name: 'JUnit', aliases: ['junit'] },
    { name: 'Postman', aliases: ['postman'] },
    { name: 'SAP', aliases: ['sap'] },
    { name: 'Salesforce', aliases: ['salesforce'] },
    { name: 'Apex', aliases: ['Apex'], caseSensitive: true },
    { name: 'Lightning Web Components', aliases: ['lightning web components', 'lwc'] },
    { name: 'OutSystems', aliases: ['outsystems'] },
    { name: 'JCL', aliases: ['JCL'], caseSensitive: true },
    { name: 'Figma', aliases: ['figma'] },
  ]),
];
