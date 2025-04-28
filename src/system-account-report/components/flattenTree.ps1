# Путь к твоему исходному файлу
$inputPath = "/workspaces/framework-codespace/src/system-account-report/data/prodScopesAndPermissions.json"
$outputPath = "/workspaces/framework-codespace/src/system-account-report/data/prodScopesAndPermissions_flat.json"

# Читаем JSON
$tree = Get-Content $inputPath -Raw | ConvertFrom-Json

# Инициализируем список для результата и счётчик ID
$flattened = @()
$idCounter = 0

function Flatten-Tree {
    param(
        [Parameter(Mandatory)] $Node,
        [Parameter()] $ParentId,
        [ref] $FlatList,
        [ref] $IdCounter
    )

    # Увеличиваем счётчик ID
    $IdCounter.Value++

    # Сохраняем текущий ID
    $currentId = $IdCounter.Value

    $FlatList.Value += [pscustomobject]@{
        id     = $currentId
        name   = $Node.name
        parent = $ParentId
    }

    foreach ($child in $Node.children) {
        Flatten-Tree -Node $child -ParentId $currentId -FlatList $FlatList -IdCounter $IdCounter
    }
}

# Запуск
Flatten-Tree -Node $tree -FlatList ([ref]$flattened) -IdCounter ([ref]$idCounter)

# Сохраняем результат
$flattened | ConvertTo-Json -Depth 5 | Out-File $outputPath -Force

Write-Output "Flattened data saved to $outputPath"