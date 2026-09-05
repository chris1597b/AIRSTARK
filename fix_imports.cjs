const fs = require('fs');
const path = require('path');

const fileMap = {
    'InfoPanel': 'features/exploration/components/InfoPanel.tsx',
    'VoiceControl': 'features/exploration/components/VoiceControl.tsx',
    'useHandControl': 'features/exploration/hooks/useHandControl.ts',
    'EKGMonitor': 'features/navigation/components/EKGMonitor.tsx',
    'Evaluation': 'features/quiz/components/Evaluation.tsx',
    'evaluationApi': 'features/quiz/services/evaluationApi.ts',
    'evaluationMapper': 'features/quiz/services/evaluationMapper.ts',
    'evaluation': 'features/quiz/types/evaluation.ts',
    'ExcalidrawEditor': 'features/whiteboard/components/ExcalidrawEditor.tsx',
    'ScreenRecorder': 'features/recording/components/ScreenRecorder.tsx',
    'CTPanel': 'features/ct-scan/components/CTPanel.tsx',
    'AuthScreen': 'features/auth/components/AuthScreen.tsx',
    'googleAuth': 'features/auth/services/googleAuth.ts',
    'geminiService': 'shared/lib/geminiService.ts',
    'sessionSocket': 'shared/lib/sessionSocket.ts',
    'types': 'shared/types/index.ts',
    'App': 'App.tsx',
    'index.css': 'index.css'
};

const oldToNew = {
    './types.ts': 'types',
    '../types.ts': 'types',
    './types/evaluation.ts': 'evaluation',
    '../types/evaluation.ts': 'evaluation',
    './hooks/useHandControl.ts': 'useHandControl',
    '../hooks/useHandControl.ts': 'useHandControl',
    './components/InfoPanel.tsx': 'InfoPanel',
    '../components/InfoPanel.tsx': 'InfoPanel',
    './components/VoiceControl.tsx': 'VoiceControl',
    '../components/VoiceControl.tsx': 'VoiceControl',
    './components/ScreenRecorder.tsx': 'ScreenRecorder',
    '../components/ScreenRecorder.tsx': 'ScreenRecorder',
    './services/geminiService.ts': 'geminiService',
    '../services/geminiService.ts': 'geminiService',
    './components/ExcalidrawEditor.tsx': 'ExcalidrawEditor',
    '../components/ExcalidrawEditor.tsx': 'ExcalidrawEditor',
    './components/Evaluation.tsx': 'Evaluation',
    '../components/Evaluation.tsx': 'Evaluation',
    './components/AuthScreen.tsx': 'AuthScreen',
    '../components/AuthScreen.tsx': 'AuthScreen',
    './services/googleAuth.ts': 'googleAuth',
    '../services/googleAuth.ts': 'googleAuth',
    './services/evaluationApi.ts': 'evaluationApi',
    '../services/evaluationApi.ts': 'evaluationApi',
    './evaluationApi.ts': 'evaluationApi', 
    './evaluationMapper.ts': 'evaluationMapper',
    '../services/evaluationMapper.ts': 'evaluationMapper',
    './sessionSocket.ts': 'sessionSocket',
    '../services/sessionSocket.ts': 'sessionSocket',
    './App.tsx': 'App',
    './index.css': 'index.css',
    '../index.css': 'index.css',
    // also handles imports without .ts or .tsx
    './types': 'types',
    '../types': 'types',
    './types/evaluation': 'evaluation',
    '../types/evaluation': 'evaluation',
    './hooks/useHandControl': 'useHandControl',
    '../hooks/useHandControl': 'useHandControl',
    './components/InfoPanel': 'InfoPanel',
    '../components/InfoPanel': 'InfoPanel',
    './components/VoiceControl': 'VoiceControl',
    '../components/VoiceControl': 'VoiceControl',
    './components/ScreenRecorder': 'ScreenRecorder',
    '../components/ScreenRecorder': 'ScreenRecorder',
    './services/geminiService': 'geminiService',
    '../services/geminiService': 'geminiService',
    './components/ExcalidrawEditor': 'ExcalidrawEditor',
    '../components/ExcalidrawEditor': 'ExcalidrawEditor',
    './components/Evaluation': 'Evaluation',
    '../components/Evaluation': 'Evaluation',
    './components/AuthScreen': 'AuthScreen',
    '../components/AuthScreen': 'AuthScreen',
    './services/googleAuth': 'googleAuth',
    '../services/googleAuth': 'googleAuth',
    './services/evaluationApi': 'evaluationApi',
    '../services/evaluationApi': 'evaluationApi',
    './evaluationApi': 'evaluationApi', 
    './evaluationMapper': 'evaluationMapper',
    '../services/evaluationMapper': 'evaluationMapper',
    './sessionSocket': 'sessionSocket',
    '../services/sessionSocket': 'sessionSocket',
    './App': 'App'
};

function getRelativePath(fromPath, targetKey) {
    const toPath = fileMap[targetKey];
    if (!toPath) return null;
    let rel = path.relative(path.dirname(fromPath), toPath).replace(/\\/g, '/');
    if (!rel.startsWith('.')) rel = './' + rel;
    return rel;
}

function processFile(filePath) {
    if (!fs.existsSync(filePath)) return;
    let content = fs.readFileSync(filePath, 'utf-8');
    let changed = false;

    const importRegex = /(import\s+.*?from\s+['"])([^'"]+)(['"])/g;
    content = content.replace(importRegex, (match, p1, p2, p3) => {
        let targetKey = oldToNew[p2];
        if (targetKey) {
            const relPath = getRelativePath(path.relative('src', filePath), targetKey);
            if (relPath) {
                changed = true;
                return `${p1}${relPath}${p3}`;
            }
        }
        return match;
    });

    const directImportRegex = /(import\s+['"])([^'"]+)(['"])/g;
    content = content.replace(directImportRegex, (match, p1, p2, p3) => {
        if(match.includes('from')) return match; 
        let targetKey = oldToNew[p2];
        if (!targetKey && p2.endsWith('index.css')) targetKey = 'index.css';
        if (targetKey) {
            const relPath = getRelativePath(path.relative('src', filePath), targetKey);
            if (relPath) {
                changed = true;
                return `${p1}${relPath}${p3}`;
            }
        }
        return match;
    });

    // Special cases like await import(...)
    const dynamicImportRegex = /(import\(['"])([^'"]+)(['"]\))/g;
    content = content.replace(dynamicImportRegex, (match, p1, p2, p3) => {
        let targetKey = oldToNew[p2];
        if (targetKey) {
            const relPath = getRelativePath(path.relative('src', filePath), targetKey);
            if (relPath) {
                changed = true;
                return `${p1}${relPath}${p3}`;
            }
        }
        return match;
    });

    if (changed) {
        fs.writeFileSync(filePath, content);
        console.log(`Updated imports in ${filePath}`);
    }
}

function walkDir(dir) {
    fs.readdirSync(dir).forEach(file => {
        const fullPath = path.join(dir, file);
        if (fs.statSync(fullPath).isDirectory()) {
            walkDir(fullPath);
        } else if (fullPath.endsWith('.ts') || fullPath.endsWith('.tsx')) {
            processFile(fullPath);
        }
    });
}

walkDir('src');

if (fs.existsSync('index.html')) {
    let htmlContent = fs.readFileSync('index.html', 'utf-8');
    if (htmlContent.includes('src="/index.tsx"')) {
        htmlContent = htmlContent.replace(/src="\/index\.tsx"/, 'src="/src/index.tsx"');
        fs.writeFileSync('index.html', htmlContent);
        console.log('Updated index.html');
    }
}
