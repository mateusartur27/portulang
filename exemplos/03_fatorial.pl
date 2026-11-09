// fatorial de um numero lido
programa
    inteiro n;
    escrever("Digite um numero: ");
    ler(n);

    inteiro resultado = 1;
    inteiro i = 2;
    enquanto (i <= n) {
        resultado = resultado * i;
        i = i + 1;
    }
    escrever(n, "! = ", resultado);
fim