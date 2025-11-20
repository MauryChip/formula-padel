# 🚀 DEPLOYMENT INSTRUCTIONS

## Step-by-Step GitHub Pages Setup

### 📋 **Pre-requisiti**
- Account GitHub (gratuito)
- Files pronti in: `/Users/maury_mac/Documents/FORMULA_PADEL_GITHUB/`

### 🔧 **Setup GitHub Repository**

1. **Vai su GitHub.com** e fai login
2. **Clicca "New Repository"** (pulsante verde)
3. **Configura repository**:
   - **Repository name**: `formula-padel`
   - **Description**: `Advanced Tournament Management System for Padel`
   - **✅ Public** (per GitHub Pages gratuito)
   - **✅ Add README file** (deseleziona, abbiamo già il nostro)
   - **Add .gitignore**: Nessuno (abbiamo già il nostro)

### 📁 **Upload Files**

**Opzione A: Web Interface (Facile)**
1. Dopo aver creato il repo, clicca **"uploading an existing file"**
2. **Trascina tutti i file** da `/Users/maury_mac/Documents/FORMULA_PADEL_GITHUB/`
3. **Commit message**: "🎾 Formula Padel v2.0 - Initial release"
4. Clicca **"Commit changes"**

**Opzione B: Git CLI (Avanzato)**
```bash
cd /Users/maury_mac/Documents/FORMULA_PADEL_GITHUB/
git init
git add .
git commit -m "🎾 Formula Padel v2.0 - Initial release"
git branch -M main
git remote add origin https://github.com/[YOUR-USERNAME]/formula-padel.git
git push -u origin main
```

### 🌐 **Attivare GitHub Pages**

1. **Nel repository**, vai su **Settings** (tab in alto)
2. **Scorri fino a "Pages"** (menu laterale sinistro)
3. **Source**: Seleziona **"Deploy from a branch"**
4. **Branch**: Seleziona **"main"** 
5. **Folder**: Seleziona **"/ (root)"**
6. Clicca **"Save"**

### ✅ **Verifica Deployment**

**Attendi 2-5 minuti**, poi:
- **URL sarà**: `https://[YOUR-USERNAME].github.io/formula-padel`
- **Check status**: Tab "Actions" nel repository
- **Verde = Success** ✅

### 🔄 **Aggiornamenti Futuri**

Per aggiornare l'app:
1. **Upload nuovi files** nel repository
2. **GitHub Pages si aggiorna automaticamente**
3. **Cache browser**: Ctrl+F5 per forzare refresh

---

## 📝 **Checklist Deployment**

- [ ] Repository GitHub creato (`formula-padel`)
- [ ] Files uploadati (tutti da FORMULA_PADEL_GITHUB/)
- [ ] GitHub Pages attivato (Settings > Pages)
- [ ] URL testato (`https://[USERNAME].github.io/formula-padel`)
- [ ] README.md personalizzato (aggiorna [YOUR-USERNAME])
- [ ] Link condiviso per beta testing

---

## 🎯 **Post-Deployment**

### **Test URL**
1. Apri: `https://[YOUR-USERNAME].github.io/formula-padel`
2. Testa workflow completo
3. Verifica mobile compatibility

### **Share per Beta Testing**
- Condividi URL diretto
- Chiedi feedback su dispositivi diversi
- Monitor GitHub Issues per bug reports

---

## 🛠️ **Risoluzione Problemi**

### **Pagina non si carica**
- Verifica che `index.html` sia presente nella root
- Check GitHub Actions per errori
- Attendi 5-10 minuti per propagazione

### **JavaScript errors**
- Tutti i files .js devono essere nella root
- Verifica path relativi (no path assoluti)

### **Aggiornamenti non visibili**
- Hard refresh: Ctrl+F5 (Chrome) / Cmd+Shift+R (Mac)
- Check timestamp ultimo commit

---

**🎾 Ready to deploy!**