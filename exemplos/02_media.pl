programa
    texto nome;
    decimal nota1;
    decimal nota2;

    escrever("Qual o seu nome? ");
    ler(nome);
    escrever("Nota 1: ");
    ler(nota1);
    escrever("Nota 2: ");
    ler(nota2);

    decimal media = (nota1 + nota2) / 2;

    se (media >= 7) {
        escrever(nome, " foi aprovado(a) com ", media);
    } senao se (media >= 5) {
        escrever(nome, " esta de recuperacao com ", media);
    } senao {
        escrever(nome, " foi reprovado(a) com ", media);
    }
fim