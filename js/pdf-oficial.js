/* Identidade oficial compartilhada por todas as exportações PDF. */
(function (global) {
  "use strict";

  const CORES = {
    verde: [47, 107, 87],
    verdeEscuro: [36, 83, 66],
    texto: [37, 51, 46],
    textoSuave: [102, 115, 110],
    borda: [220, 229, 225],
    fundoCabecalho: [246, 250, 248],
  };

  const IDENTIDADE_PADRAO = {
    nome: "Pilates Rafaela Lisboa",
    subtitulo: "Gestão de Pilates",
    telefone: "",
    email: "",
    endereco: "",
    cnpj: "",
  };

  function identidadeAtual() {
    const configurada = global.configEstudioPDF || global.__configEstudioPDF || {};
    return { ...IDENTIDADE_PADRAO, ...configurada };
  }

  function textoIdentidade(info) {
    return [info.telefone, info.email, info.endereco, info.cnpj]
      .filter(Boolean)
      .join(" • ");
  }

  function desenharMarca(doc, x, y, tamanho = 5) {
    doc.setFillColor(...CORES.verde);
    doc.circle(x, y, tamanho, "F");
    doc.setDrawColor(255, 255, 255);
    doc.setLineWidth(0.8);
    doc.line(x - tamanho * 0.48, y + tamanho * 0.1, x, y - tamanho * 0.48);
    doc.line(x, y - tamanho * 0.48, x + tamanho * 0.48, y + tamanho * 0.1);
    doc.line(x - tamanho * 0.42, y + tamanho * 0.18, x + tamanho * 0.42, y + tamanho * 0.18);
  }

  function aplicarEstiloTabela(doc) {
    if (typeof doc.autoTableSetDefaults !== "function") return;
    doc.autoTableSetDefaults({
      theme: "grid",
      styles: {
        font: "helvetica",
        fontSize: 8.5,
        textColor: CORES.texto,
        lineColor: CORES.borda,
        lineWidth: 0.2,
        cellPadding: 3,
        overflow: "linebreak",
      },
      headStyles: {
        fillColor: CORES.verde,
        textColor: [255, 255, 255],
        fontStyle: "bold",
        halign: "left",
      },
      alternateRowStyles: { fillColor: [248, 251, 249] },
      margin: { left: 14, right: 14, top: 42, bottom: 18 },
    });
  }

  function desenharCabecalho(doc, info) {
    const largura = doc.internal.pageSize.getWidth();
    doc.setFillColor(...CORES.fundoCabecalho);
    doc.rect(0, 0, largura, 15, "F");
    doc.setFillColor(...CORES.verde);
    doc.rect(0, 14, largura, 1.2, "F");
    desenharMarca(doc, 18, 7.5, 4.2);
    doc.setTextColor(...CORES.verdeEscuro);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(10);
    doc.text(info.nome, 25, 9.5);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(7.5);
    const complemento = [info.subtitulo, textoIdentidade(info)].filter(Boolean).join(" • ");
    if (complemento) {
      doc.setTextColor(...CORES.textoSuave);
      doc.text(complemento, largura - 14, 9.5, { align: "right" });
    }
  }

  function desenharRodape(doc, info) {
    const paginas = doc.getNumberOfPages();
    const altura = doc.internal.pageSize.getHeight();
    const largura = doc.internal.pageSize.getWidth();
    for (let pagina = 1; pagina <= paginas; pagina += 1) {
      doc.setPage(pagina);
      doc.setDrawColor(...CORES.borda);
      doc.setLineWidth(0.25);
      doc.line(14, altura - 13, largura - 14, altura - 13);
      doc.setTextColor(...CORES.textoSuave);
      doc.setFont("helvetica", "normal");
      doc.setFontSize(7.5);
      doc.text(`${info.nome} • Documento interno • Uso profissional • ${new Date().toLocaleDateString("pt-BR")}`, 14, altura - 7.5);
      doc.text(`Página ${pagina} de ${paginas}`, largura - 14, altura - 7.5, { align: "right" });
    }
  }

  function configurarPDFOficial(doc, opcoes = {}) {
    if (!doc || doc.__pdfOficialConfigurado) return doc;
    const info = { ...identidadeAtual(), ...(opcoes.identidade || {}) };
    doc.__pdfOficialConfigurado = true;
    doc.__pdfOficialInfo = info;
    doc.setProperties({
      title: opcoes.titulo || "Documento oficial",
      subject: opcoes.assunto || "Documento gerado pelo sistema de gestão",
      author: info.nome,
      creator: "Sistema de Gestão Pilates",
      keywords: "Pilates, gestão, relatório",
    });
    aplicarEstiloTabela(doc);
    desenharCabecalho(doc, info);
    const salvarOriginal = doc.save.bind(doc);
    doc.save = function salvarPDFOficial(nomeArquivo, ...args) {
      desenharRodape(doc, info);
      return salvarOriginal(nomeArquivo, ...args);
    };
    return doc;
  }

  global.configurarPDFOficial = configurarPDFOficial;
  global.obterIdentidadePDFOficial = identidadeAtual;
  global.definirIdentidadePDFOficial = function (configuracao) {
    global.configEstudioPDF = { ...IDENTIDADE_PADRAO, ...(configuracao || {}) };
    return global.configEstudioPDF;
  };
  global.desenharCabecalhoPDFOficial = function (doc) {
    if (doc) desenharCabecalho(doc, identidadeAtual());
  };
})(window);
