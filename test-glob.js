function matchesPattern(url, pattern, matchType) {
    if (matchType === 'regex') {
        try {
            const regex = new RegExp(pattern);
            return regex.test(url);
        } catch {
            return false;
        }
    } else {
        // Convert glob pattern to regex
        const regexPattern = pattern
            .replace(/[.+^${}()|[\]\\]/g, '\\$&') // Escape special regex chars
            .replace(/\*/g, '.*') // * matches any characters
            .replace(/\?/g, '.'); // ? matches single character

        try {
            const regex = new RegExp(`^${regexPattern}$`);
            console.log('Pattern:', pattern);
            console.log('Regex pattern:', regexPattern);
            console.log('Final regex:', regex);
            console.log('URL:', url);
            console.log('Result:', regex.test(url));
            return regex.test(url);
        } catch (e) {
            console.log('Error:', e);
            return false;
        }
    }
}

console.log('Test:', matchesPattern('https://api.example.com/test', '*.example.com/*', 'glob'));
