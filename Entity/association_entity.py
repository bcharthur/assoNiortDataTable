class Association:
    def __init__(self, title, category, sub_category, website,
                 manager, contact, phone, mobile, mail, address, description):
        self.title = title
        self.category = category
        self.sub_category = sub_category
        self.website = website
        self.manager = manager
        self.contact = contact
        self.phone = phone
        self.mobile = mobile
        self.mail = mail
        self.address = address
        self.description = description
        lat: float
        lon: float

    def to_dict(self):
        return self.__dict__
