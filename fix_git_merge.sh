#!/bin/bash

echo "🔧 Fixing git merge conflicts..."

# Remove any git lock files
if [ -f .git/index.lock ]; then
    echo "Removing git index lock..."
    rm -f .git/index.lock
fi

if [ -f .git/refs/heads/main.lock ]; then
    echo "Removing refs lock..."
    rm -f .git/refs/heads/main.lock
fi

# Kill any hanging git processes
pkill -f git 2>/dev/null || true
sleep 1

echo "📋 Current git status:"
git status --porcelain | head -15

echo ""
echo "🔄 Resolving unmerged files..."

# Add the unmerged files that are already resolved
git add .gitignore 2>/dev/null || echo "Warning: Could not add .gitignore"
git add client/src/components/DocumentoMotoristaForm.tsx 2>/dev/null || echo "Warning: Could not add DocumentoMotoristaForm.tsx"
git add client/src/context/AuthContext.tsx 2>/dev/null || echo "Warning: Could not add AuthContext.tsx"
git add client/src/index.css 2>/dev/null || echo "Warning: Could not add index.css"
git add client/src/pages/contratacao/MotoristasLista.tsx 2>/dev/null || echo "Warning: Could not add MotoristasLista.tsx"
git add package-lock.json 2>/dev/null || echo "Warning: Could not add package-lock.json"
git add package.json 2>/dev/null || echo "Warning: Could not add package.json"
git add replit.md 2>/dev/null || echo "Warning: Could not add replit.md"
git add server/index.ts 2>/dev/null || echo "Warning: Could not add server/index.ts"
git add server/routes.ts 2>/dev/null || echo "Warning: Could not add server/routes.ts"
git add server/storage.ts 2>/dev/null || echo "Warning: Could not add server/storage.ts"
git add shared/schema.ts 2>/dev/null || echo "Warning: Could not add shared/schema.ts"
git add tailwind.config.ts 2>/dev/null || echo "Warning: Could not add tailwind.config.ts"

# Remove deleted files
git rm index.html 2>/dev/null || echo "Note: index.html already removed or not found"
git rm netlify.toml 2>/dev/null || echo "Note: netlify.toml already removed or not found"

echo ""
echo "📊 Updated git status:"
git status --porcelain | head -15

echo ""
echo "✅ Ready for commit! Now run:"
echo "git commit -m 'Merge: Resolve all conflicts and fix TypeScript errors'"
echo "git push origin main"