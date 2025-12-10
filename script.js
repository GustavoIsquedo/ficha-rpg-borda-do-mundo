// O CÓDIGO DO FIREBASE E DE CONTROLE DE ÁUDIO ESTÁ NO INDEX.HTML.
// ESTE ARQUIVO (SCRIPT.JS) CONTÉM A LÓGICA DO FORMULÁRIO E DO FIREBASE.

// --- ELEMENTOS DO DOM ---
const charForm = document.querySelector('.char-form');
const charClassSelect = document.getElementById('char-class');
const attributeInputs = document.querySelectorAll('.attribute-allocator input[type="number"]');
const skillCheckboxes = document.querySelectorAll('.skill-checkbox-group input[type="checkbox"]');
const sheetsUl = document.getElementById('sheets-ul');

// --- CONSTANTES ---
const ATTRIBUTE_POINTS_TOTAL = 5;
const FIXED_SKILLS = {
    peregrino: ['Fé (Desconhecido)', 'Sobrevivência'],
    erudito: ['Reparos', 'Investigação'],
    protetor: ['Combate C.A.C.', 'Resiliência']
};
const RESTRICTED_SKILLS = {
    peregrino: ['Resiliência'], 
    erudito: ['Fé (Desconhecido)', 'Resiliência'],
    protetor: ['Fé (Desconhecido)', 'Reparos']
};
const MAX_SKILL_CHOICES = 2; // Peregrino e Protetor
const MAX_ERUDITO_SKILL_CHOICES = 3; // Exceção para Erudito


// --- FUNÇÕES DE LÓGICA DO JOGO ---

// 1. Atualiza as restrições de Perícia com base na Classe
function updateSkillRestrictions() {
    const selectedClass = charClassSelect.value;
    const fixed = FIXED_SKILLS[selectedClass];
    const restricted = RESTRICTED_SKILLS[selectedClass];
    
    // Passa por todos os checkboxes
    skillCheckboxes.forEach(checkbox => {
        const skillName = checkbox.value;
        const label = checkbox.parentNode;

        // Resetar estados
        checkbox.disabled = false;
        label.classList.remove('restricted', 'fixed-skill');
        checkbox.checked = false;

        // Definir Perícias Fixas
        if (fixed.includes(skillName)) {
            checkbox.checked = true;
            checkbox.disabled = true;
            label.classList.add('fixed-skill');
        } 
        
        // Definir Perícias Restritas
        if (restricted.includes(skillName)) {
            checkbox.disabled = true;
            label.classList.add('restricted');
            checkbox.checked = false; // Garante que não está marcado
        }
    });
    
    // Reaplicar a checagem de limite, caso o usuário tenha mais de 2/3 marcadas
    checkSkillLimit();
}

// 2. Garante o limite de Perícias escolhidas (variável por classe)
function checkSkillLimit() {
    const selectedClass = charClassSelect.value;
    const maxChoices = (selectedClass === 'erudito') ? MAX_ERUDITO_SKILL_CHOICES : MAX_SKILL_CHOICES;
    
    // Contar apenas as perícias marcadas que *não* são fixas
    let chosenCount = 0;
    
    skillCheckboxes.forEach(checkbox => {
        const isFixed = FIXED_SKILLS[selectedClass].includes(checkbox.value);

        if (checkbox.checked && !isFixed) {
            chosenCount++;
        }
    });
    
    // Desabilitar as perícias restantes se o limite for atingido
    skillCheckboxes.forEach(checkbox => {
        const isFixed = FIXED_SKILLS[selectedClass].includes(checkbox.value);
        const isRestricted = RESTRICTED_SKILLS[selectedClass].includes(checkbox.value);
        
        if (chosenCount >= maxChoices && !checkbox.checked && !isFixed && !isRestricted) {
            checkbox.disabled = true;
            checkbox.parentNode.classList.add('restricted'); // Reusa a classe 'restricted' para visual de desabilitado
        } else if (!isFixed && !isRestricted) {
            // Reabilitar se o limite não foi atingido
            checkbox.disabled = false;
            checkbox.parentNode.classList.remove('restricted');
        }
    });
}

// 3. Verifica a soma de pontos de Atributo
function checkAttributePoints() {
    let currentTotal = 0;
    attributeInputs.forEach(input => {
        currentTotal += parseInt(input.value) || 0;
    });

    // Se o total exceder o limite, recalcula
    if (currentTotal > ATTRIBUTE_POINTS_TOTAL) {
        alert(`O total de pontos de Atributo não pode exceder ${ATTRIBUTE_POINTS_TOTAL}. Você deve diminuir um valor.`);
        
        // Tentativa de corrigir: reseta o último valor modificado ou o valor que excedeu.
        // Como o JS não sabe qual foi o último, a maneira mais segura é apenas avisar
        // e deixar o usuário corrigir, ou resetar o último campo preenchido.
        // Neste exemplo, vamos apenas alertar. O evento 'change' ou 'input' no HTML
        // teria que ser mais inteligente para saber qual campo foi o último.
        
        // Por enquanto, apenas destacamos o problema.
        
        return false;
    }
    return true;
}


// --- LÓGICA DE PERSISTÊNCIA (FIRESTORE) ---

// 4. Salva a ficha no Firestore
async function saveCharacterSheet(data) {
    try {
        await db.collection('character_sheets').add(data);
        console.log("Ficha salva com sucesso!");
        // Após salvar, recarrega a lista
        loadCharacterSheets();
    } catch (e) {
        console.error("Erro ao adicionar documento: ", e);
        alert("Erro ao salvar a ficha. Verifique o console para detalhes ou sua conexão com o Firebase.");
    }
}

// 5. Carrega a lista de fichas do Firestore
function loadCharacterSheets() {
    sheetsUl.innerHTML = '<li>Carregando devotos...</li>'; // Feedback de carregamento
    
    db.collection('character_sheets').get().then((querySnapshot) => {
        sheetsUl.innerHTML = ''; // Limpa a lista
        
        if (querySnapshot.empty) {
            sheetsUl.innerHTML = '<li>Nenhum devoto registrado ainda.</li>';
            return;
        }

        querySnapshot.forEach((doc) => {
            const data = doc.data();
            const li = document.createElement('li');
            const a = document.createElement('a');
            
            // Exibe o Nome e a Classe
            a.textContent = `${data.name} (${data.class})`;
            a.href = '#'; // Link dummy, pode ser ajustado para exibir a ficha
            
            // Função para exibir detalhes (simples alert para demonstração)
            a.onclick = (e) => {
                e.preventDefault();
                alert(
                    `--- Ficha de ${data.name} ---\n` +
                    `Classe: ${data.class}\n` +
                    `Motivação: ${data.motivation}\n\n` +
                    `Atributos: \n${Object.entries(data.attributes).map(([key, value]) => `${key}: ${value}`).join(', ')}\n\n` +
                    `Perícias: \n${data.skills.join(', ')}`
                );
            };
            
            li.appendChild(a);
            sheetsUl.appendChild(li);
        });
    }).catch(error => {
        console.error("Erro ao carregar fichas: ", error);
        sheetsUl.innerHTML = '<li>Erro ao carregar lista. (Verifique o Firebase)</li>';
    });
}


// --- LISTENERS DE EVENTOS ---

// Inicializa restrições ao carregar a página
document.addEventListener('DOMContentLoaded', () => {
    updateSkillRestrictions();
    loadCharacterSheets();
});

// Atualiza restrições sempre que a classe é alterada
charClassSelect.addEventListener('change', updateSkillRestrictions);

// Verifica o limite de perícias a cada clique/mudança no checkbox
skillCheckboxes.forEach(checkbox => {
    checkbox.addEventListener('change', checkSkillLimit);
});

// Garante que a soma de atributos não exceda o limite
attributeInputs.forEach(input => {
    input.addEventListener('input', checkAttributePoints);
});

// Lógica de Submissão do Formulário
charForm.addEventListener('submit', (e) => {
    e.preventDefault();
    
    // 1. Validação Final de Atributos
    if (!checkAttributePoints()) {
        return;
    }
    
    // 2. Coletar Atributos
    const attributes = {};
    let totalAttr = 0;
    attributeInputs.forEach(input => {
        const value = parseInt(input.value) || 0;
        attributes[input.name.toUpperCase()] = value;
        totalAttr += value;
    });
    
    // Validação extra (garante que todos os 5 pontos foram usados)
    if (totalAttr !== ATTRIBUTE_POINTS_TOTAL) {
        alert(`Você deve distribuir exatamente ${ATTRIBUTE_POINTS_TOTAL} pontos de Atributo. Total usado: ${totalAttr}.`);
        return;
    }
    
    // 3. Coletar Perícias
    const skills = [];
    skillCheckboxes.forEach(checkbox => {
        if (checkbox.checked) {
            skills.push(checkbox.value);
        }
    });

    // 4. Coletar outros dados
    const charData = {
        name: document.getElementById('char-name').value,
        class: charClassSelect.value.charAt(0).toUpperCase() + charClassSelect.value.slice(1), // Capitaliza
        motivation: document.getElementById('char-motivation').value,
        attributes: attributes,
        skills: skills,
        createdAt: firebase.firestore.FieldValue.serverTimestamp()
    };

    // 5. Salvar a Ficha
    saveCharacterSheet(charData);
    
    // Limpar o formulário (opcional)
    charForm.reset();
    updateSkillRestrictions(); // Reseta as restrições da classe após a submissão
});

// --- EXECUÇÃO INICIAL ---
// A execução inicial já está no DOMContentLoaded.