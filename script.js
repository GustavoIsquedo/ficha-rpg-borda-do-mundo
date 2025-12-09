const maxPoints = 5;
const pointsDisplay = document.querySelector('.points-available strong');
const attributeInputs = document.querySelectorAll('.attribute-row input[type="number"]');
const skillCheckboxes = document.querySelectorAll('.skill-checkbox-group input[type="checkbox"]');
const classSelect = document.getElementById('char-class');
const form = document.querySelector('.char-form');
const pointsAvailableText = document.querySelector('.points-available');
let currentPoints = 0;

// Definições de Perícias e restrições por Classe
const classRestrictions = {
    peregrino: { fixed: ['Fé (Desconhecido)', 'Sobrevivência'], exclude: ['Sobrevivência', 'Resiliência'], numChoices: 2 },
    erudito: { fixed: ['Reparos', 'Investigação'], exclude: ['Fé (Desconhecido)', 'Resiliência'], numChoices: 3 },
    protetor: { fixed: ['Combate C.A.C.', 'Resiliência'], exclude: ['Fé (Desconhecido)', 'Reparos'], numChoices: 2 }
};

// --- LÓGICA DE ATRIBUTOS (5 PONTOS) ---

function updatePoints() {
    let total = 0;
    attributeInputs.forEach(input => {
        const value = parseInt(input.value) || 0;
        total += value;
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
                const overage = currentPoints - maxPoints;
                input.value = value - overage;
                updatePoints();
            }
        });
    });
}


// --- LÓGICA DE PERÍCIAS (RESTRIÇÕES DE CLASSE) ---

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
    
    // 1. VALIDAÇÃO
    if (currentPoints !== maxPoints) {
        alert(`Atenção! Você deve distribuir exatamente ${maxPoints} Pontos de Atributo. Restam: ${maxPoints - currentPoints}.`);
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
        attributes[input.name.toUpperCase()] = 10 + parseInt(input.value || 0); 
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
        atributos: attributes,
        pericias: allSkills,
        defesas: {
            esquivar_base: attributes.DES * 2 + (allSkills.Velocidade ? 3 : 0),
            defender_base: attributes.CON * 2 + (allSkills.Resiliência ? 3 : 0)
        },
        // Variável de controle importante!
        criado_em: firebase.firestore.FieldValue.serverTimestamp() 
    };
    
    // 3. SALVAR NO FIRESTORE
    try {
        // Cria um ID seguro para o documento no Firebase
        const safeNameId = charName.replace(/[^a-z0-9]/gi, '_').toLowerCase();

        // Salva a ficha online (o Mestre acessa este dado)
        await db.collection("fichas").doc(safeNameId).set(characterData);
        
        // 4. Feedback Simples para o Jogador
        alert(`A Pedra Celestial aceitou sua Vontade, ${charName}! Sua ficha foi submetida e o Mestre enviará o link de visualização.`);
        
        // Limpar o formulário para uma nova ficha
        form.reset(); 
        updatePoints();
        updateSkillCount();

    } catch (error) {
        console.error("Erro ao salvar a ficha no Firebase:", error);
        alert("Ocorreu um erro ao salvar a ficha online. Tente novamente.");
    }
});


// --- INICIALIZAÇÃO ---

enforceMaxPoints();
updatePoints();
updateSkillCount();