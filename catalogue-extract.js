const fs = require('fs').promises;

// Load profile ID from file
let profileId;
try {
  profileId = (await fs.readFile('ibm.profileid', 'utf8')).trim();
} catch (error) {
  console.error('Error reading ibm.profileid file:', error.message);
  console.error('Please ensure the ibm.profileid file exists and contains your profile ID.');
  process.exit(1);
}

async function fetchPage(from = 0) {
  const baseBody = "search=&tab.sessioncatalogtabs=option_1601178495160&type=session&browserTimezone=America%2FVancouver&catalogDisplay=list";
  const body = from > 0 ? `${baseBody}&from=${from}` : baseBody;
  const response = await fetch("https://events.tools.ibm.com/api/search", {
    "headers": {
      "accept": "*/*",
      "accept-language": "en-US,en-CA;q=0.9,en;q=0.8,pt-BR;q=0.7,pt;q=0.6,fr;q=0.5,fr-FR;q=0.4",
      "content-type": "application/x-www-form-urlencoded; charset=UTF-8",
      "priority": "u=1, i",
      "rfapiprofileid": profileId,
      "sec-ch-ua": "\"Not)A;Brand\";v=\"8\", \"Chromium\";v=\"138\", \"Microsoft Edge\";v=\"138\"",
      "sec-ch-ua-mobile": "?0",
      "sec-ch-ua-platform": "\"Windows\"",
      "sec-fetch-dest": "empty",
      "sec-fetch-mode": "cors",
      "sec-fetch-site": "same-site",
      "Referer": "https://reg.tools.ibm.com/"
    },
    "body": body,
    "method": "POST"
  });

  return await response.json();
}

async function main() {
  try {
    console.log('Fetching data from API...');
    
    // Get first page to determine total count
    const firstPage = await fetchPage(0);
    const totalItems = firstPage.totalSearchItems || 0;
    console.log(`Total items available: ${totalItems}`);
    
    // Collect all items
    let allItems = [];
    if (firstPage.sectionList && firstPage.sectionList[0] && firstPage.sectionList[0].items) {
      allItems = [...firstPage.sectionList[0].items];
    }
    
    // Fetch remaining pages
    const pageSize = 50;
    let from = pageSize;
    
    while (from < totalItems) {
      console.log(`Fetching items ${from + 1} to ${Math.min(from + pageSize, totalItems)}...`);
      
      const pageData = await fetchPage(from);
      
      let pageItems = [];
      
      // Check if items are in the root level (pagination responses)
      if (pageData.items && Array.isArray(pageData.items)) {
        pageItems = pageData.items;
      }
      // Check if items are in sectionList structure (first page format)
      else if (pageData.sectionList && pageData.sectionList[0] && pageData.sectionList[0].items) {
        pageItems = pageData.sectionList[0].items;
      }
      
      if (pageItems.length > 0) {
        allItems = allItems.concat(pageItems);
      }
      
      from += pageSize;
      
      // Add a small delay to be respectful to the API
      await new Promise(resolve => setTimeout(resolve, 500));
    }
    
    // Create the complete data structure
    const completeData = {
      ...firstPage,
      sectionList: [{
        ...firstPage.sectionList[0],
        items: allItems,
        numItems: allItems.length,
        total: allItems.length
      }]
    };
    
    await fs.writeFile('output.json', JSON.stringify(completeData, null, 2));
    
    console.log(`Successfully fetched ${allItems.length} items and saved to output.json`);
  } catch (error) {
    console.error('Error:', error);
  }
}

main();
