const {test}=require('node:test');
const assert=require('node:assert/strict');
test('Notebook lookups narrow to the current edition; general and cross-source lookups stay unrestricted',async()=>{
  const {queryArchivistCandidate,mapArchivistSources}=await import('../lib/archivist-core.mjs');
  for(const [query,scoped] of [
    ['What happens in The Useful Detour?',true],
    ['Which note has pasta recipes and a shopping list?',true],
    ['How does extra work affect task cost?',false],
    ['Compare The Useful Detour to Effective Task Cost.',false],
    ['Can you make a shopping list?',false],
  ]){
    let search;
    const candidate=await queryArchivistCandidate({query},'fixture',{fetchImpl:async(_,options)=>{
      search=JSON.parse(options.body).tools[0].fileSearch;
      return Response.json({candidates:[{content:{parts:[{text:'No retrieved evidence.'}]}}]});
    }});
    assert.equal(search.metadataFilter,scoped?'slug="notebook" AND site_revision="afb94b6"':undefined);
    assert.deepEqual(mapArchivistSources(candidate.groundingMetadata),[],'A title match alone cannot create a citation');
  }
});
