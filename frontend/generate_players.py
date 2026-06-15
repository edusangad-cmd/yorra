import json

teams = [
  "Alemania", "Arabia Saudí", "Argelia", "Argentina", "Australia", "Austria", "Bélgica", 
  "Bosnia y Herzegovina", "Brasil", "Cabo Verde", "Canadá", "Catar", "Colombia", 
  "Corea del Sur", "Costa de Marfil", "Croacia", "Curazao", "Ecuador", "Egipto", "Escocia", 
  "España", "Estados Unidos", "Francia", "Ghana", "Haití", "Inglaterra", "Irán", "Irak", 
  "Japón", "Jordania", "Marruecos", "México", "Noruega", "Nueva Zelanda", "Países Bajos", 
  "Panamá", "Paraguay", "Portugal", "República Checa", "República Democrática del Congo", 
  "Senegal", "Sudáfrica", "Suecia", "Suiza", "Túnez", "Turquía", "Uruguay", "Uzbekistán"
]

forwards = {
  "Alemania": ["Jamal Musiala", "Florian Wirtz", "Kai Havertz", "Leroy Sané", "Niclas Füllkrug", "Thomas Müller", "Serge Gnabry", "Timo Werner"],
  "Arabia Saudí": ["Salem Al-Dawsari", "Firas Al-Buraikan", "Saleh Al-Shehri", "Fahad Al-Muwallad"],
  "Argelia": ["Riyad Mahrez", "Amine Gouiri", "Baghdad Bounedjah", "Islam Slimani", "Said Benrahma"],
  "Argentina": ["Lionel Messi", "Lautaro Martínez", "Julián Álvarez", "Ángel Di María", "Paulo Dybala", "Alejandro Garnacho", "Nicolás González"],
  "Australia": ["Mitchell Duke", "Craig Goodwin", "Nestory Irankunda", "Martin Boyle", "Awer Mabil"],
  "Austria": ["Marko Arnautović", "Michael Gregoritsch", "Marcel Sabitzer", "Christoph Baumgartner", "Sasa Kalajdzic"],
  "Bélgica": ["Romelu Lukaku", "Jérémy Doku", "Leandro Trossard", "Kevin De Bruyne", "Lois Openda", "Charles De Ketelaere", "Dries Mertens"],
  "Bosnia y Herzegovina": ["Edin Džeko", "Ermedin Demirović", "Smail Prevljak"],
  "Brasil": ["Vinícius Jr", "Rodrygo", "Neymar Jr", "Raphinha", "Endrick", "Richarlison", "Gabriel Martinelli", "Gabriel Jesus"],
  "Cabo Verde": ["Ryan Mendes", "Garry Rodrigues", "Bebé", "Jovane Cabral"],
  "Canadá": ["Jonathan David", "Cyle Larin", "Tajon Buchanan", "Alphonso Davies"],
  "Catar": ["Akram Afif", "Almoez Ali", "Hassan Al-Haydos"],
  "Colombia": ["Luis Díaz", "James Rodríguez", "Jhon Durán", "Luis Sinisterra", "Rafael Santos Borré", "Jhon Arias"],
  "Corea del Sur": ["Son Heung-min", "Hwang Hee-chan", "Lee Kang-in", "Cho Gue-sung"],
  "Costa de Marfil": ["Sébastien Haller", "Simon Adingra", "Nicolas Pépé", "Wilfried Zaha", "Jonathan Bamba"],
  "Croacia": ["Andrej Kramarić", "Ivan Perišić", "Bruno Petković", "Ante Budimir"],
  "Curazao": ["Juninho Bacuna", "Kenji Gorré", "Jürgen Locadia", "Rangelo Janga"],
  "Ecuador": ["Enner Valencia", "Kevin Rodríguez", "Gonzalo Plata", "Jordy Caicedo"],
  "Egipto": ["Mohamed Salah", "Mostafa Mohamed", "Omar Marmoush", "Mahmoud Trézéguet"],
  "Escocia": ["John McGinn", "Che Adams", "Lyndon Dykes", "Lawrence Shankland"],
  "España": ["Lamine Yamal", "Nico Williams", "Álvaro Morata", "Dani Olmo", "Mikel Oyarzabal", "Joselu", "Ferran Torres", "Gerard Moreno"],
  "Estados Unidos": ["Christian Pulisic", "Folarin Balogun", "Timothy Weah", "Ricardo Pepi", "Giovanni Reyna", "Brenden Aaronson"],
  "Francia": ["Kylian Mbappé", "Antoine Griezmann", "Ousmane Dembélé", "Marcus Thuram", "Olivier Giroud", "Kingsley Coman", "Randal Kolo Muani", "Christopher Nkunku"],
  "Ghana": ["Mohammed Kudus", "Inaki Williams", "Jordan Ayew", "Antoine Semenyo", "Andre Ayew"],
  "Haití": ["Duckens Nazon", "Frantzdy Pierrot", "Carnejy Antoine"],
  "Inglaterra": ["Harry Kane", "Bukayo Saka", "Phil Foden", "Cole Palmer", "Marcus Rashford", "Jack Grealish", "Ollie Watkins", "Ivan Toney"],
  "Irán": ["Mehdi Taremi", "Sardar Azmoun", "Alireza Jahanbakhsh", "Mehdi Ghayedi"],
  "Irak": ["Aymen Hussein", "Mohanad Ali", "Ali Al-Hamadi"],
  "Japón": ["Kaoru Mitoma", "Takefusa Kubo", "Ayase Ueda", "Takumi Minamino", "Daizen Maeda", "Ritsu Doan"],
  "Jordania": ["Mousa Al-Tamari", "Yazan Al-Naimat", "Ali Olwan"],
  "Marruecos": ["Youssef En-Nesyri", "Hakim Ziyech", "Brahim Díaz", "Abde Ezzalzouli", "Amine Adli", "Ayoub El Kaabi"],
  "México": ["Santiago Giménez", "Hirving Lozano", "Raúl Jiménez", "Uriel Antuna", "Julián Quiñones", "Henry Martín"],
  "Noruega": ["Erling Haaland", "Alexander Sørloth", "Jørgen Strand Larsen", "Oscar Bobb"],
  "Nueva Zelanda": ["Chris Wood", "Ben Waine", "Kosta Barbarouses", "Elijah Just"],
  "Países Bajos": ["Cody Gakpo", "Memphis Depay", "Xavi Simons", "Wout Weghorst", "Donyell Malen", "Brian Brobbey", "Steven Bergwijn"],
  "Panamá": ["José Fajardo", "Ismael Díaz", "Cecilio Waterman", "Eduardo Guerrero"],
  "Paraguay": ["Julio Enciso", "Miguel Almirón", "Antonio Sanabria", "Derlis González", "Adam Bareiro"],
  "Portugal": ["Cristiano Ronaldo", "Rafael Leão", "João Félix", "Bernardo Silva", "Diogo Jota", "Gonçalo Ramos", "Pedro Neto"],
  "República Checa": ["Patrik Schick", "Adam Hložek", "Tomáš Čvančara", "Mojmír Chytil"],
  "República Democrática del Congo": ["Yoane Wissa", "Cédric Bakambu", "Meschak Elia", "Simon Banza"],
  "Senegal": ["Sadio Mané", "Nicolas Jackson", "Ismaïla Sarr", "Boulaye Dia", "Habib Diallo"],
  "Sudáfrica": ["Percy Tau", "Lyle Foster", "Zakhele Lepasa", "Evidence Makgopa"],
  "Suecia": ["Alexander Isak", "Viktor Gyökeres", "Dejan Kulusevski", "Anthony Elanga", "Emil Forsberg"],
  "Suiza": ["Breel Embolo", "Zeki Amdouni", "Noah Okafor", "Xherdan Shaqiri", "Ruben Vargas"],
  "Túnez": ["Youssef Msakni", "Elias Achouri", "Seifeddine Jaziri", "Haythem Jouini"],
  "Turquía": ["Arda Güler", "Kenan Yıldız", "Cenk Tosun", "Kerem Aktürkoğlu", "Enes Ünal", "Barış Alper Yılmaz"],
  "Uruguay": ["Darwin Núñez", "Luis Suárez", "Facundo Pellistri", "Brian Rodríguez", "Maximiliano Araújo"],
  "Uzbekistán": ["Eldor Shomurodov", "Oston Urunov", "Igor Sergeev", "Jaloliddin Masharipov"]
}

gks = {
  "Alemania": ["Manuel Neuer", "Marc-André ter Stegen", "Kevin Trapp"],
  "Arabia Saudí": ["Mohammed Al-Owais", "Nawaf Al-Aqidi"],
  "Argelia": ["Anthony Mandrea", "Raïs M'Bolhi"],
  "Argentina": ["Emiliano Martínez", "Franco Armani", "Gerónimo Rulli"],
  "Australia": ["Mathew Ryan", "Joe Gauci"],
  "Austria": ["Patrick Pentz", "Heinz Lindner"],
  "Bélgica": ["Koen Casteels", "Thibaut Courtois", "Matz Sels"],
  "Bosnia y Herzegovina": ["Nikola Vasilj", "Ibrahim Šehić"],
  "Brasil": ["Alisson Becker", "Ederson", "Bento"],
  "Cabo Verde": ["Vozinha", "Márcio da Rosa"],
  "Canadá": ["Maxime Crépeau", "Milan Borjan"],
  "Catar": ["Meshaal Barsham", "Saad Al-Sheeb"],
  "Colombia": ["Camilo Vargas", "David Ospina", "Álvaro Montero"],
  "Corea del Sur": ["Jo Hyeon-woo", "Kim Seung-gyu"],
  "Costa de Marfil": ["Yahia Fofana", "Badra Ali Sangaré"],
  "Croacia": ["Dominik Livaković", "Ivica Ivušić"],
  "Curazao": ["Eloy Room", "Trevor Doornbusch"],
  "Ecuador": ["Alexander Domínguez", "Hernán Galíndez"],
  "Egipto": ["Mohamed El Shenawy", "Gabaski"],
  "Escocia": ["Angus Gunn", "Craig Gordon"],
  "España": ["Unai Simón", "David Raya", "Álex Remiro"],
  "Estados Unidos": ["Matt Turner", "Ethan Horvath"],
  "Francia": ["Mike Maignan", "Brice Samba", "Alphonse Areola"],
  "Ghana": ["Lawrence Ati-Zigi", "Richard Ofori"],
  "Haití": ["Johny Placide", "Garissone Innocent"],
  "Inglaterra": ["Jordan Pickford", "Aaron Ramsdale", "Nick Pope"],
  "Irán": ["Alireza Beiranvand", "Hossein Hosseini"],
  "Irak": ["Jalal Hassan", "Fahad Talib"],
  "Japón": ["Zion Suzuki", "Daniel Schmidt"],
  "Jordania": ["Yazid Abu Layla", "Abdallah Al-Fakhouri"],
  "Marruecos": ["Yassine Bounou", "Munir Mohamedi"],
  "México": ["Luis Malagón", "Guillermo Ochoa", "Julio González"],
  "Noruega": ["Ørjan Nyland", "Egil Selvik"],
  "Nueva Zelanda": ["Alex Paulsen", "Max Crocombe"],
  "Países Bajos": ["Bart Verbruggen", "Mark Flekken", "Justin Bijlow"],
  "Panamá": ["Orlando Mosquera", "Luis Mejía"],
  "Paraguay": ["Carlos Coronel", "Roberto Fernández"],
  "Portugal": ["Diogo Costa", "Rui Patrício", "José Sá"],
  "República Checa": ["Jindřich Staněk", "Matěj Kovář"],
  "República Democrática del Congo": ["Lionel Mpasi", "Dimitry Bertaud"],
  "Senegal": ["Édouard Mendy", "Seny Dieng"],
  "Sudáfrica": ["Ronwen Williams", "Veli Mothwa"],
  "Suecia": ["Robin Olsen", "Viktor Johansson"],
  "Suiza": ["Yann Sommer", "Gregor Kobel"],
  "Túnez": ["Bechir Ben Saïd", "Aymen Dahmen"],
  "Turquía": ["Uğurcan Çakır", "Mert Günok", "Altay Bayındır"],
  "Uruguay": ["Sergio Rochet", "Santiago Mele"],
  "Uzbekistán": ["Utkir Yusupov", "Abduvohid Nematov"]
}

out_fwd = []
out_gk = []

for team in teams:
    for f in forwards.get(team, []):
        out_fwd.append(f"{f} ({team})")
    for g in gks.get(team, []):
        out_gk.append(f"{g} ({team})")

import os
os.makedirs("src/data", exist_ok=True)

with open("src/data/players.ts", "w") as f:
    f.write("export const ALL_FORWARDS = [\n")
    for p in sorted(out_fwd):
        f.write(f"  \"{p}\",\n")
    f.write("];\n\n")

    f.write("export const ALL_GOALKEEPERS = [\n")
    for p in sorted(out_gk):
        f.write(f"  \"{p}\",\n")
    f.write("];\n")

print("Generated src/data/players.ts")
