programa
    inteiro idade = 25;
    logico maior = idade >= 18;
    logico tem_carteira = verdadeiro;

    se (maior e tem_carteira) {
        escrever("Pode dirigir: ", maior e tem_carteira);
    }
    se (nao maior ou nao tem_carteira) {
        escrever("Nao pode dirigir");
    }
fim