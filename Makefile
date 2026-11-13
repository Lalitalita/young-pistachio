# Raccourcis : `make help`. Équivalents docker bruts dans le README.
.PHONY: help up update logs ps down reset kiosk test
help:
	@echo "make up      # build + démarrage"
	@echo "make update  # git pull + rebuild"
	@echo "make logs    # logs de l'app (Ctrl+C pour quitter)"
	@echo "make ps      # état des services"
	@echo "make down    # arrêt"
	@echo "make reset   # reset de fin de journée (efface la base)"
	@echo "make kiosk   # Chromium plein écran sur /screen"
	@echo "make test    # tests back + front, dans Docker"
up:
	./cyber.sh up
update:
	./cyber.sh update
logs:
	./cyber.sh logs
ps:
	./cyber.sh ps
down:
	./cyber.sh down
reset:
	./cyber.sh reset
kiosk:
	./cyber.sh kiosk
test:
	./cyber.sh test
