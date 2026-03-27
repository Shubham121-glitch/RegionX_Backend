const axios = require('axios');
const FormData = require('form-data');
const fs = require('fs');
const path = require('path');

const API_URL = 'http://localhost:5000/api';

const uploadRegion = async () => {
  const form = new FormData();
  
  // Basic info
  form.append('regionName', 'Bhaderwah');
  form.append('shortDescription', 'Known as Mini Kashmir, Bhaderwah is a stunning valley in District Doda with lush green meadows and ancient temples.');
  form.append('detailedDescription', 'Bhaderwah, often called "Mini Kashmir" or "Chota Kashmir," is a town and tehsil in the Doda district of Jammu and Kashmir. Situated at the foothills of the Himalayan mountains, it is known for its natural beauty, green valleys, dense forests, and scenic landscapes. It is a hub for adventure sports like paragliding and trekking, and is rich in cultural heritage, famously known as the land of snakes (Naagon ki Bhoomi).');
  form.append('history', 'Historically, Bhaderwah was part of the ancient principalities of Kishtwar and Bhadarwah. It was a vital part of the Dogra kingdom and witnessed various ruling groups over centuries. The old Fort of Doda played a crucial role in the region\'s defense before its demolition in 1952.');
  form.append('culturalValues', 'Bhaderwah boasts a diverse cultural heritage where Hindu, Muslim, and Sikh communities coexist harmoniously. It is known for its intricate handicrafts like Kashmiri rugs, embroidered shawls, and the unique Bina work. Traditional folk dances like Dhakku and Ghurai are significant parts of local celebrations.');
  form.append('traditions', 'The region is famous for fairs and festivals like Mela Patt, a 600-year-old festival symbolizing Nag Culture. Kanchoth festival, similar to Karwa Chouth, is celebrated by women. Local fairs known as Jaters are annual celebrations dedicated to Nag deities involving specific rituals and community feasts.');

  // Media
  const artifactsDir = 'C:\\Users\\yesye\\.gemini\\antigravity\\brain\\39456262-0aba-4f51-96ab-6799fe883f69';
  
  // Thumbnail
  form.append('thumbnail', fs.createReadStream(path.join(artifactsDir, 'bhaderwah_valley_1774594257088.png')));
  
  // Gallery Images
  form.append('images', fs.createReadStream(path.join(artifactsDir, 'jai_valley_meadows_1774594278624.png')));
  form.append('images', fs.createReadStream(path.join(artifactsDir, 'chinta_valley_paragliding_1774594403627.png')));
  
  // Places to Visit
  const places = [
    { 
      name: 'Jai Valley', 
      description: 'An enchanting high-altitude meadow about 32-35 km from Bhaderwah, known for its dense pine and Deodar forests, pristine streams, and green meadows.' 
    },
    { 
      name: 'Chinta Valley', 
      description: 'A picturesque valley situated at 6500 ft, surrounded by thick coniferous forests, ideal for paragliding and picnics.' 
    },
    { 
      name: 'Gupt Ganga Temple', 
      description: 'An ancient Shiv temple on the banks of Neru River. Legend say Pandavas stayed here during exile. A mysterious stream water falls on the Shiv Lingam.' 
    }
  ];
  form.append('placesToVisit', JSON.stringify(places));
  
  // Place Images (aligned with places indices)
  form.append('placeImages', fs.createReadStream(path.join(artifactsDir, 'jai_valley_meadows_1774594278624.png')));
  form.append('placeImages', fs.createReadStream(path.join(artifactsDir, 'chinta_valley_paragliding_1774594403627.png')));
  form.append('placeImages', fs.createReadStream(path.join(artifactsDir, 'gupt_ganga_temple_1774594338873.png')));

  try {
    const response = await axios.post(`${API_URL}/regions`, form, {
      headers: { ...form.getHeaders() }
    });
    console.log('Success:', response.data);
  } catch (err) {
    console.error('Error:', err.response ? err.response.data : err.message);
  }
};

uploadRegion();
