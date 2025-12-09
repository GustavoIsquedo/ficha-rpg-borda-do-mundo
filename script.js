const maxPoints = 5;
const attributeBase = 1; // NOVO: Atributo inicial base é 1
const pointsDisplay = document.querySelector('.points-available strong');
const attributeInputs = document.querySelectorAll('.attribute-row input[type="number"]');
const skillCheckboxes = document.querySelectorAll('.skill-checkbox-group input[type="checkbox"]');
const classSelect = document.getElementById('char-class');
const form = document.querySelector('.char-form');
const pointsAvailableText = document.querySelector('.points-available');
const sheetsUl = document.getElementById('sheets-ul'); 
let currentPoints = 0;

// Definições de Perícias e restrições por Classe
const classRestrictions = {
    peregrino: { fixed: ['Fé (Desconhecido)', 'Sobrevivência'], exclude: ['Sobrevivência', 'Resiliência'], numChoices: 2 },
    erudito: { fixed: ['Reparos', 'Investigação'], exclude: ['Fé (Desconhecido)', 'Resiliência'], numChoices: 3 },
    protetor: { fixed: ['Combate C.A.C.', 'Resiliência'], exclude: ['Fé (Desconhecido)', 'Reparos'], numChoices: 2 }
};

// --- FUNÇÃO NOVO: CARREGAR LISTA DE FICHAS (Inalterada) ---

async function loadCreatedSheets() {
    sheetsUl.innerHTML = '<li>Buscando Eleitos...</li>';
    
    // Obtém o URL base atual (ex: https://seusuario.github.io/rpg-borda-do-mundo/)
    const currentUrl = window.location.href.split('?')[0]; // Remove query params
    const baseUrl = currentUrl.substring(0, currentUrl.lastIndexOf('/') + 1);
    const fichaPage = baseUrl + 'ficha.html';

    try {
        // Busca todas as fichas, ordenadas pelo nome
        const snapshot = await db.collection("fichas").orderBy("nome", "asc").get();

        if (snapshot.empty) {
            sheetsUl.innerHTML = '<li>Nenhuma ficha submetida ainda.</li>';
            return;
        }

        let listHTML = '';
        snapshot.forEach(doc => {
            const data = doc.data();
            const safeId = doc.id; // O ID seguro é o nome do documento
            const link = `${fichaPage}?id=${safeId}`;
            
            listHTML += `<li><a href="${link}" target="_blank">${data.nome}</a></li>`;
        });

        sheetsUl.innerHTML = listHTML;

    } catch (error) {
        console.error("Erro ao carregar lista de fichas:", error);
        sheetsUl.innerHTML = '<li>Erro ao carregar lista. Verifique a conexão.</li>';
    }
}


// --- LÓGICA DE ATRIBUTOS (5 PONTOS) ---

function updatePoints() {
    let total = 0;
    attributeInputs.forEach(input => {
        // NOVO: Calcula os pontos distribuídos acima da base 1
        const value = parseInt(input.value) || 0;
        // Subtrai a base 1 para saber quantos pontos (acima do mínimo) o jogador gastou
        total += (value - attributeBase); 
    });

    currentPoints = total;
    const remaining = maxPoints - currentPoints;
    
    pointsDisplay.textContent = remaining;

    if (remaining < 0) {
        pointsAvailableText.style.color = '#ff4d4d';
    } else {
        pointsAvailableText.style.color = '#ccc';
    }
}

function enforceMaxPoints() {
    attributeInputs.forEach(input => {
        input.addEventListener('input', () => {
            updatePoints();
            let value = parseInt(input.value) || 0;

            if (currentPoints > maxPoints) {
                // Se exceder, o valor do input é ajustado para a diferença
                const overage = currentPoints - maxPoints;
                // O valor final do input deve ser: valor_atual - overage
                // Como value é a soma de todos os pontos (base+alocados), e currentPoints já inclui todos os alocados,
                // a lógica é mais simples: ajuste para que a soma dos pontos alocados seja exatamente maxPoints.
                input.value = value - overage;
                
                // Garante que não caia abaixo do mínimo (1)
                if (input.value < attributeBase) {
                    input.value = attributeBase;
                }
                
                updatePoints();
            }
        });
    });
}


// --- LÓGICA DE PERÍCIAS (RESTRIÇÕES DE CLASSE - Inalterada) ---

function updateSkillCount() {
    const selectedClass = classSelect.value;
    const restrictions = classRestrictions[selectedClass];
    let checkedCount = 0;

    skillCheckboxes.forEach(checkbox => {
        if (checkbox.checked && !restrictions.fixed.includes(checkbox.value)) {
            checkedCount++;
        }
    });

    skillCheckboxes.forEach(checkbox => {
        const skillName = checkbox.value;
        const isFixed = restrictions.fixed.includes(skillName);
        const isExcluded = restrictions.exclude.includes(skillName);
        const isChecked = checkbox.checked;

        // Regra: Desabilitar se já atingiu o limite de escolhas E não for uma perícia fixa
        if (checkedCount >= restrictions.numChoices && !isChecked && !isFixed) {
            checkbox.disabled = true;
        } else {
            checkbox.disabled = isFixed || isExcluded;
        }

        // Se for fixa, deve estar marcada (e desabilitada)
        if (isFixed) {
            checkbox.checked = true;
            checkbox.disabled = true;
            checkbox.closest('label').classList.add('fixed-skill');
        } else {
            checkbox.closest('label').classList.remove('fixed-skill');
        }
        
        // Se for excluída, desabilitar e garantir que não esteja marcada
        if (isExcluded) {
            checkbox.disabled = true;
            checkbox.checked = false;
            checkbox.closest('label').classList.add('restricted');
        } else {
            checkbox.closest('label').classList.remove('restricted');
        }
    });
}

// Inicializa a lógica quando a classe é trocada
classSelect.addEventListener('change', updateSkillCount);
skillCheckboxes.forEach(checkbox => checkbox.addEventListener('change', updateSkillCount));


// --- LÓGICA DE SUBMISSÃO E SALVAMENTO (ONLINE) ---

form.addEventListener('submit', async function(event) {
    event.preventDefault(); 
    
    // 1. VALIDAÇÃO (Completa)
    if (currentPoints !== maxPoints) {
        alert(`Atenção! Você deve distribuir exatamente ${maxPoints} Pontos de Atributo. Pontos alocados: ${currentPoints}.`);
        return;
    }
    
    const selectedClass = classSelect.value;
    const restrictions = classRestrictions[selectedClass];
    let checkedCount = 0;

    skillCheckboxes.forEach(checkbox => {
        if (checkbox.checked && !restrictions.fixed.includes(checkbox.value)) {
            checkedCount++;
        }
    });

    if (checkedCount !== restrictions.numChoices) {
        alert(`Atenção! A classe ${selectedClass.toUpperCase()} requer ${restrictions.numChoices} escolhas de Perícias. Você escolheu ${checkedCount}.`);
        return;
    }

    // 2. COLETAR E MONTAR DADOS DA FICHA
    const charName = document.getElementById('char-name').value;
    const pvBase = selectedClass === 'protetor' ? 10 : (selectedClass === 'peregrino' ? 7 : 6);

    const attributes = {};
    attributeInputs.forEach(input => {
        // NOVO: O valor do atributo (número de dados) é o valor do input (1 a 4)
        attributes[input.name.toUpperCase()] = parseInt(input.value || attributeBase); 
    });

    const allSkills = {};
    document.querySelectorAll('.skill-checkbox-group input[type="checkbox"]').forEach(checkbox => {
        allSkills[checkbox.value] = checkbox.checked;
    });

    const characterData = {
        nome: charName,
        classe: selectedClass,
        motivacao: document.getElementById('char-motivation').value,
        pv_base: pvBase,
        atributos: attributes, // O valor é o número de dados (1 a 4)
        defesas: {
            // NOVO: O cálculo deve usar o número de dados (valor do input) para o bônus
            esquivar_base: attributes.DES * 2 + (allSkills.Velocidade ? 3 : 0),
            defender_base: attributes.CON * 2 + (allSkills.Resiliência ? 3 : 0)
        },
        pericias: allSkills,
        criado_em: firebase.firestore.FieldValue.serverTimestamp() 
    };
    
    // 3. SALVAR NO FIRESTORE
    try {
        const safeNameId = charName.replace(/[^a-z0-9]/gi, '_').toLowerCase();

        await db.collection("fichas").doc(safeNameId).set(characterData);
        
        // 4. Feedback Simples para o Jogador e ATUALIZAR LISTA
        alert(`A Deusa de Pedra aceitou sua Vontade, ${charName}! Sua ficha foi submetida e agora está disponível na lista lateral.`);
        
        form.reset(); 
        
        // Reset manual dos atributos para o valor base (1)
        attributeInputs.forEach(input => input.value = attributeBase);

        updatePoints();
        updateSkillCount();
        
        // Recarrega a lista para mostrar a nova ficha
        loadCreatedSheets(); 

    } catch (error) {
        console.error("Erro ao salvar a ficha no Firebase:", error);
        alert("Ocorreu um erro ao salvar a ficha online. Tente novamente.");
    }
});


// --- INICIALIZAÇÃO ---

enforceMaxPoints();
updatePoints();
updateSkillCount();

loadCreatedSheets();