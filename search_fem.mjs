import https from 'https';

const options = {
    hostname: 'api.github.com',
    path: '/search/repositories?q=finite+element+language:typescript+OR+language:javascript&sort=stars&order=desc',
    headers: { 'User-Agent': 'Node.js' }
};

https.get(options, (res) => {
    let data = '';
    res.on('data', chunk => data += chunk);
    res.on('end', () => {
        const json = JSON.parse(data);
        const repos = json.items.slice(0, 10).map(i => ({
            name: i.full_name,
            stars: i.stargazers_count,
            desc: i.description
        }));
        console.log(JSON.stringify(repos, null, 2));
    });
}).on('error', err => console.error(err));
