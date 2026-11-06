export interface CategoryPresetItem {
  divisionGroup: "OPEN" | "PELAJAR" | "DISABILITAS" | "VETERAN" | "BOB";
  subGroup?: string;
  name: string;
  categoryType: "KATA_INDIVIDUAL" | "KATA_TEAM" | "KUMITE_INDIVIDUAL" | "KUMITE_TEAM";
  gender: "MALE" | "FEMALE" | "MIXED";
  minAge?: number | null;
  maxAge?: number | null;
  minBirthDate?: string | null;
  maxBirthDate?: string | null;
  minWeight?: number | null;
  maxWeight?: number | null;
  defaultFee?: number;
}

export const TOURNAMENT_CATEGORY_PRESETS: CategoryPresetItem[] = [
  // ==================================================
  // 1. KATEGORI TERBUKA / OPEN
  // ==================================================
  // A. PRA USIA DINI (Kelahiran 2019-2020 / Usia 6-7 Tahun)
  {
    divisionGroup: "OPEN",
    subGroup: "Pra Usia Dini (6-7 Thn / 2019-2020)",
    name: "Pra Usia Dini - Kata Perorangan Putra",
    categoryType: "KATA_INDIVIDUAL",
    gender: "MALE",
    minAge: 6,
    maxAge: 7,
    minBirthDate: "2019-01-01",
    maxBirthDate: "2020-12-31",
  },
  {
    divisionGroup: "OPEN",
    subGroup: "Pra Usia Dini (6-7 Thn / 2019-2020)",
    name: "Pra Usia Dini - Kata Perorangan Putri",
    categoryType: "KATA_INDIVIDUAL",
    gender: "FEMALE",
    minAge: 6,
    maxAge: 7,
    minBirthDate: "2019-01-01",
    maxBirthDate: "2020-12-31",
  },
  {
    divisionGroup: "OPEN",
    subGroup: "Pra Usia Dini (6-7 Thn / 2019-2020)",
    name: "Pra Usia Dini - Kumite Putra -20 kg",
    categoryType: "KUMITE_INDIVIDUAL",
    gender: "MALE",
    minAge: 6,
    maxAge: 7,
    minBirthDate: "2019-01-01",
    maxBirthDate: "2020-12-31",
    maxWeight: 20,
  },
  {
    divisionGroup: "OPEN",
    subGroup: "Pra Usia Dini (6-7 Thn / 2019-2020)",
    name: "Pra Usia Dini - Kumite Putra +20 kg",
    categoryType: "KUMITE_INDIVIDUAL",
    gender: "MALE",
    minAge: 6,
    maxAge: 7,
    minBirthDate: "2019-01-01",
    maxBirthDate: "2020-12-31",
    minWeight: 20.1,
  },
  {
    divisionGroup: "OPEN",
    subGroup: "Pra Usia Dini (6-7 Thn / 2019-2020)",
    name: "Pra Usia Dini - Kumite Putri -20 kg",
    categoryType: "KUMITE_INDIVIDUAL",
    gender: "FEMALE",
    minAge: 6,
    maxAge: 7,
    minBirthDate: "2019-01-01",
    maxBirthDate: "2020-12-31",
    maxWeight: 20,
  },
  {
    divisionGroup: "OPEN",
    subGroup: "Pra Usia Dini (6-7 Thn / 2019-2020)",
    name: "Pra Usia Dini - Kumite Putri +20 kg",
    categoryType: "KUMITE_INDIVIDUAL",
    gender: "FEMALE",
    minAge: 6,
    maxAge: 7,
    minBirthDate: "2019-01-01",
    maxBirthDate: "2020-12-31",
    minWeight: 20.1,
  },

  // B. USIA DINI (Kelahiran 2017-2018 / Usia 8-9 Tahun)
  {
    divisionGroup: "OPEN",
    subGroup: "Usia Dini (8-9 Thn / 2017-2018)",
    name: "Usia Dini - Kata Perorangan Putra",
    categoryType: "KATA_INDIVIDUAL",
    gender: "MALE",
    minAge: 8,
    maxAge: 9,
    minBirthDate: "2017-01-01",
    maxBirthDate: "2018-12-31",
  },
  {
    divisionGroup: "OPEN",
    subGroup: "Usia Dini (8-9 Thn / 2017-2018)",
    name: "Usia Dini - Kata Perorangan Putri",
    categoryType: "KATA_INDIVIDUAL",
    gender: "FEMALE",
    minAge: 8,
    maxAge: 9,
    minBirthDate: "2017-01-01",
    maxBirthDate: "2018-12-31",
  },
  {
    divisionGroup: "OPEN",
    subGroup: "Usia Dini (8-9 Thn / 2017-2018)",
    name: "Usia Dini - Kata Beregu Putra",
    categoryType: "KATA_TEAM",
    gender: "MALE",
    minAge: 8,
    maxAge: 9,
    minBirthDate: "2017-01-01",
    maxBirthDate: "2018-12-31",
    defaultFee: 250000,
  },
  {
    divisionGroup: "OPEN",
    subGroup: "Usia Dini (8-9 Thn / 2017-2018)",
    name: "Usia Dini - Kata Beregu Putri",
    categoryType: "KATA_TEAM",
    gender: "FEMALE",
    minAge: 8,
    maxAge: 9,
    minBirthDate: "2017-01-01",
    maxBirthDate: "2018-12-31",
    defaultFee: 250000,
  },
  {
    divisionGroup: "OPEN",
    subGroup: "Usia Dini (8-9 Thn / 2017-2018)",
    name: "Usia Dini - Kumite Putra -25 kg",
    categoryType: "KUMITE_INDIVIDUAL",
    gender: "MALE",
    minAge: 8,
    maxAge: 9,
    minBirthDate: "2017-01-01",
    maxBirthDate: "2018-12-31",
    maxWeight: 25,
  },
  {
    divisionGroup: "OPEN",
    subGroup: "Usia Dini (8-9 Thn / 2017-2018)",
    name: "Usia Dini - Kumite Putra -30 kg",
    categoryType: "KUMITE_INDIVIDUAL",
    gender: "MALE",
    minAge: 8,
    maxAge: 9,
    minBirthDate: "2017-01-01",
    maxBirthDate: "2018-12-31",
    minWeight: 25.1,
    maxWeight: 30,
  },
  {
    divisionGroup: "OPEN",
    subGroup: "Usia Dini (8-9 Thn / 2017-2018)",
    name: "Usia Dini - Kumite Putra +30 kg",
    categoryType: "KUMITE_INDIVIDUAL",
    gender: "MALE",
    minAge: 8,
    maxAge: 9,
    minBirthDate: "2017-01-01",
    maxBirthDate: "2018-12-31",
    minWeight: 30.1,
  },
  {
    divisionGroup: "OPEN",
    subGroup: "Usia Dini (8-9 Thn / 2017-2018)",
    name: "Usia Dini - Kumite Putri -25 kg",
    categoryType: "KUMITE_INDIVIDUAL",
    gender: "FEMALE",
    minAge: 8,
    maxAge: 9,
    minBirthDate: "2017-01-01",
    maxBirthDate: "2018-12-31",
    maxWeight: 25,
  },
  {
    divisionGroup: "OPEN",
    subGroup: "Usia Dini (8-9 Thn / 2017-2018)",
    name: "Usia Dini - Kumite Putri -30 kg",
    categoryType: "KUMITE_INDIVIDUAL",
    gender: "FEMALE",
    minAge: 8,
    maxAge: 9,
    minBirthDate: "2017-01-01",
    maxBirthDate: "2018-12-31",
    minWeight: 25.1,
    maxWeight: 30,
  },
  {
    divisionGroup: "OPEN",
    subGroup: "Usia Dini (8-9 Thn / 2017-2018)",
    name: "Usia Dini - Kumite Putri +30 kg",
    categoryType: "KUMITE_INDIVIDUAL",
    gender: "FEMALE",
    minAge: 8,
    maxAge: 9,
    minBirthDate: "2017-01-01",
    maxBirthDate: "2018-12-31",
    minWeight: 30.1,
  },

  // C. PRA PEMULA (Kelahiran 2015-2016 / Usia 10-11 Tahun)
  {
    divisionGroup: "OPEN",
    subGroup: "Pra Pemula (10-11 Thn / 2015-2016)",
    name: "Pra Pemula - Kata Perorangan Putra",
    categoryType: "KATA_INDIVIDUAL",
    gender: "MALE",
    minAge: 10,
    maxAge: 11,
    minBirthDate: "2015-01-01",
    maxBirthDate: "2016-12-31",
  },
  {
    divisionGroup: "OPEN",
    subGroup: "Pra Pemula (10-11 Thn / 2015-2016)",
    name: "Pra Pemula - Kata Perorangan Putri",
    categoryType: "KATA_INDIVIDUAL",
    gender: "FEMALE",
    minAge: 10,
    maxAge: 11,
    minBirthDate: "2015-01-01",
    maxBirthDate: "2016-12-31",
  },
  {
    divisionGroup: "OPEN",
    subGroup: "Pra Pemula (10-11 Thn / 2015-2016)",
    name: "Pra Pemula - Kata Beregu Putra",
    categoryType: "KATA_TEAM",
    gender: "MALE",
    minAge: 10,
    maxAge: 11,
    minBirthDate: "2015-01-01",
    maxBirthDate: "2016-12-31",
    defaultFee: 250000,
  },
  {
    divisionGroup: "OPEN",
    subGroup: "Pra Pemula (10-11 Thn / 2015-2016)",
    name: "Pra Pemula - Kata Beregu Putri",
    categoryType: "KATA_TEAM",
    gender: "FEMALE",
    minAge: 10,
    maxAge: 11,
    minBirthDate: "2015-01-01",
    maxBirthDate: "2016-12-31",
    defaultFee: 250000,
  },
  {
    divisionGroup: "OPEN",
    subGroup: "Pra Pemula (10-11 Thn / 2015-2016)",
    name: "Pra Pemula - Kumite Putra -30 kg",
    categoryType: "KUMITE_INDIVIDUAL",
    gender: "MALE",
    minAge: 10,
    maxAge: 11,
    minBirthDate: "2015-01-01",
    maxBirthDate: "2016-12-31",
    maxWeight: 30,
  },
  {
    divisionGroup: "OPEN",
    subGroup: "Pra Pemula (10-11 Thn / 2015-2016)",
    name: "Pra Pemula - Kumite Putra -35 kg",
    categoryType: "KUMITE_INDIVIDUAL",
    gender: "MALE",
    minAge: 10,
    maxAge: 11,
    minBirthDate: "2015-01-01",
    maxBirthDate: "2016-12-31",
    minWeight: 30.1,
    maxWeight: 35,
  },
  {
    divisionGroup: "OPEN",
    subGroup: "Pra Pemula (10-11 Thn / 2015-2016)",
    name: "Pra Pemula - Kumite Putra -40 kg",
    categoryType: "KUMITE_INDIVIDUAL",
    gender: "MALE",
    minAge: 10,
    maxAge: 11,
    minBirthDate: "2015-01-01",
    maxBirthDate: "2016-12-31",
    minWeight: 35.1,
    maxWeight: 40,
  },
  {
    divisionGroup: "OPEN",
    subGroup: "Pra Pemula (10-11 Thn / 2015-2016)",
    name: "Pra Pemula - Kumite Putra +40 kg",
    categoryType: "KUMITE_INDIVIDUAL",
    gender: "MALE",
    minAge: 10,
    maxAge: 11,
    minBirthDate: "2015-01-01",
    maxBirthDate: "2016-12-31",
    minWeight: 40.1,
  },
  {
    divisionGroup: "OPEN",
    subGroup: "Pra Pemula (10-11 Thn / 2015-2016)",
    name: "Pra Pemula - Kumite Putri -30 kg",
    categoryType: "KUMITE_INDIVIDUAL",
    gender: "FEMALE",
    minAge: 10,
    maxAge: 11,
    minBirthDate: "2015-01-01",
    maxBirthDate: "2016-12-31",
    maxWeight: 30,
  },
  {
    divisionGroup: "OPEN",
    subGroup: "Pra Pemula (10-11 Thn / 2015-2016)",
    name: "Pra Pemula - Kumite Putri -35 kg",
    categoryType: "KUMITE_INDIVIDUAL",
    gender: "FEMALE",
    minAge: 10,
    maxAge: 11,
    minBirthDate: "2015-01-01",
    maxBirthDate: "2016-12-31",
    minWeight: 30.1,
    maxWeight: 35,
  },
  {
    divisionGroup: "OPEN",
    subGroup: "Pra Pemula (10-11 Thn / 2015-2016)",
    name: "Pra Pemula - Kumite Putri +35 kg",
    categoryType: "KUMITE_INDIVIDUAL",
    gender: "FEMALE",
    minAge: 10,
    maxAge: 11,
    minBirthDate: "2015-01-01",
    maxBirthDate: "2016-12-31",
    minWeight: 35.1,
  },

  // D. PEMULA (Kelahiran 2013-2014 / Usia 12-13 Tahun)
  {
    divisionGroup: "OPEN",
    subGroup: "Pemula (12-13 Thn / 2013-2014)",
    name: "Pemula - Kata Perorangan Putra",
    categoryType: "KATA_INDIVIDUAL",
    gender: "MALE",
    minAge: 12,
    maxAge: 13,
    minBirthDate: "2013-01-01",
    maxBirthDate: "2014-12-31",
  },
  {
    divisionGroup: "OPEN",
    subGroup: "Pemula (12-13 Thn / 2013-2014)",
    name: "Pemula - Kata Perorangan Putri",
    categoryType: "KATA_INDIVIDUAL",
    gender: "FEMALE",
    minAge: 12,
    maxAge: 13,
    minBirthDate: "2013-01-01",
    maxBirthDate: "2014-12-31",
  },
  {
    divisionGroup: "OPEN",
    subGroup: "Pemula (12-13 Thn / 2013-2014)",
    name: "Pemula - Kata Beregu Putra",
    categoryType: "KATA_TEAM",
    gender: "MALE",
    minAge: 12,
    maxAge: 13,
    minBirthDate: "2013-01-01",
    maxBirthDate: "2014-12-31",
    defaultFee: 250000,
  },
  {
    divisionGroup: "OPEN",
    subGroup: "Pemula (12-13 Thn / 2013-2014)",
    name: "Pemula - Kata Beregu Putri",
    categoryType: "KATA_TEAM",
    gender: "FEMALE",
    minAge: 12,
    maxAge: 13,
    minBirthDate: "2013-01-01",
    maxBirthDate: "2014-12-31",
    defaultFee: 250000,
  },
  {
    divisionGroup: "OPEN",
    subGroup: "Pemula (12-13 Thn / 2013-2014)",
    name: "Pemula - Kumite Putra -35 kg",
    categoryType: "KUMITE_INDIVIDUAL",
    gender: "MALE",
    minAge: 12,
    maxAge: 13,
    minBirthDate: "2013-01-01",
    maxBirthDate: "2014-12-31",
    maxWeight: 35,
  },
  {
    divisionGroup: "OPEN",
    subGroup: "Pemula (12-13 Thn / 2013-2014)",
    name: "Pemula - Kumite Putra -40 kg",
    categoryType: "KUMITE_INDIVIDUAL",
    gender: "MALE",
    minAge: 12,
    maxAge: 13,
    minBirthDate: "2013-01-01",
    maxBirthDate: "2014-12-31",
    minWeight: 35.1,
    maxWeight: 40,
  },
  {
    divisionGroup: "OPEN",
    subGroup: "Pemula (12-13 Thn / 2013-2014)",
    name: "Pemula - Kumite Putra -45 kg",
    categoryType: "KUMITE_INDIVIDUAL",
    gender: "MALE",
    minAge: 12,
    maxAge: 13,
    minBirthDate: "2013-01-01",
    maxBirthDate: "2014-12-31",
    minWeight: 40.1,
    maxWeight: 45,
  },
  {
    divisionGroup: "OPEN",
    subGroup: "Pemula (12-13 Thn / 2013-2014)",
    name: "Pemula - Kumite Putra -50 kg",
    categoryType: "KUMITE_INDIVIDUAL",
    gender: "MALE",
    minAge: 12,
    maxAge: 13,
    minBirthDate: "2013-01-01",
    maxBirthDate: "2014-12-31",
    minWeight: 45.1,
    maxWeight: 50,
  },
  {
    divisionGroup: "OPEN",
    subGroup: "Pemula (12-13 Thn / 2013-2014)",
    name: "Pemula - Kumite Putra +50 kg",
    categoryType: "KUMITE_INDIVIDUAL",
    gender: "MALE",
    minAge: 12,
    maxAge: 13,
    minBirthDate: "2013-01-01",
    maxBirthDate: "2014-12-31",
    minWeight: 50.1,
  },
  {
    divisionGroup: "OPEN",
    subGroup: "Pemula (12-13 Thn / 2013-2014)",
    name: "Pemula - Kumite Putri -35 kg",
    categoryType: "KUMITE_INDIVIDUAL",
    gender: "FEMALE",
    minAge: 12,
    maxAge: 13,
    minBirthDate: "2013-01-01",
    maxBirthDate: "2014-12-31",
    maxWeight: 35,
  },
  {
    divisionGroup: "OPEN",
    subGroup: "Pemula (12-13 Thn / 2013-2014)",
    name: "Pemula - Kumite Putri -40 kg",
    categoryType: "KUMITE_INDIVIDUAL",
    gender: "FEMALE",
    minAge: 12,
    maxAge: 13,
    minBirthDate: "2013-01-01",
    maxBirthDate: "2014-12-31",
    minWeight: 35.1,
    maxWeight: 40,
  },
  {
    divisionGroup: "OPEN",
    subGroup: "Pemula (12-13 Thn / 2013-2014)",
    name: "Pemula - Kumite Putri -45 kg",
    categoryType: "KUMITE_INDIVIDUAL",
    gender: "FEMALE",
    minAge: 12,
    maxAge: 13,
    minBirthDate: "2013-01-01",
    maxBirthDate: "2014-12-31",
    minWeight: 40.1,
    maxWeight: 45,
  },
  {
    divisionGroup: "OPEN",
    subGroup: "Pemula (12-13 Thn / 2013-2014)",
    name: "Pemula - Kumite Putri +45 kg",
    categoryType: "KUMITE_INDIVIDUAL",
    gender: "FEMALE",
    minAge: 12,
    maxAge: 13,
    minBirthDate: "2013-01-01",
    maxBirthDate: "2014-12-31",
    minWeight: 45.1,
  },

  // E. KADET (Kelahiran 2011-2012 / Usia 14-15 Tahun)
  {
    divisionGroup: "OPEN",
    subGroup: "Kadet (14-15 Thn / 2011-2012)",
    name: "Kadet - Kata Perorangan Putra",
    categoryType: "KATA_INDIVIDUAL",
    gender: "MALE",
    minAge: 14,
    maxAge: 15,
    minBirthDate: "2011-01-01",
    maxBirthDate: "2012-12-31",
  },
  {
    divisionGroup: "OPEN",
    subGroup: "Kadet (14-15 Thn / 2011-2012)",
    name: "Kadet - Kata Perorangan Putri",
    categoryType: "KATA_INDIVIDUAL",
    gender: "FEMALE",
    minAge: 14,
    maxAge: 15,
    minBirthDate: "2011-01-01",
    maxBirthDate: "2012-12-31",
  },
  {
    divisionGroup: "OPEN",
    subGroup: "Kadet (14-15 Thn / 2011-2012)",
    name: "Kadet - Kata Beregu Putra",
    categoryType: "KATA_TEAM",
    gender: "MALE",
    minAge: 14,
    maxAge: 15,
    minBirthDate: "2011-01-01",
    maxBirthDate: "2012-12-31",
    defaultFee: 250000,
  },
  {
    divisionGroup: "OPEN",
    subGroup: "Kadet (14-15 Thn / 2011-2012)",
    name: "Kadet - Kata Beregu Putri",
    categoryType: "KATA_TEAM",
    gender: "FEMALE",
    minAge: 14,
    maxAge: 15,
    minBirthDate: "2011-01-01",
    maxBirthDate: "2012-12-31",
    defaultFee: 250000,
  },
  {
    divisionGroup: "OPEN",
    subGroup: "Kadet (14-15 Thn / 2011-2012)",
    name: "Kadet - Kumite Putra -52 kg",
    categoryType: "KUMITE_INDIVIDUAL",
    gender: "MALE",
    minAge: 14,
    maxAge: 15,
    minBirthDate: "2011-01-01",
    maxBirthDate: "2012-12-31",
    maxWeight: 52,
  },
  {
    divisionGroup: "OPEN",
    subGroup: "Kadet (14-15 Thn / 2011-2012)",
    name: "Kadet - Kumite Putra -57 kg",
    categoryType: "KUMITE_INDIVIDUAL",
    gender: "MALE",
    minAge: 14,
    maxAge: 15,
    minBirthDate: "2011-01-01",
    maxBirthDate: "2012-12-31",
    minWeight: 52.1,
    maxWeight: 57,
  },
  {
    divisionGroup: "OPEN",
    subGroup: "Kadet (14-15 Thn / 2011-2012)",
    name: "Kadet - Kumite Putra -63 kg",
    categoryType: "KUMITE_INDIVIDUAL",
    gender: "MALE",
    minAge: 14,
    maxAge: 15,
    minBirthDate: "2011-01-01",
    maxBirthDate: "2012-12-31",
    minWeight: 57.1,
    maxWeight: 63,
  },
  {
    divisionGroup: "OPEN",
    subGroup: "Kadet (14-15 Thn / 2011-2012)",
    name: "Kadet - Kumite Putra -70 kg",
    categoryType: "KUMITE_INDIVIDUAL",
    gender: "MALE",
    minAge: 14,
    maxAge: 15,
    minBirthDate: "2011-01-01",
    maxBirthDate: "2012-12-31",
    minWeight: 63.1,
    maxWeight: 70,
  },
  {
    divisionGroup: "OPEN",
    subGroup: "Kadet (14-15 Thn / 2011-2012)",
    name: "Kadet - Kumite Putra +70 kg",
    categoryType: "KUMITE_INDIVIDUAL",
    gender: "MALE",
    minAge: 14,
    maxAge: 15,
    minBirthDate: "2011-01-01",
    maxBirthDate: "2012-12-31",
    minWeight: 70.1,
  },
  {
    divisionGroup: "OPEN",
    subGroup: "Kadet (14-15 Thn / 2011-2012)",
    name: "Kadet - Kumite Putri -47 kg",
    categoryType: "KUMITE_INDIVIDUAL",
    gender: "FEMALE",
    minAge: 14,
    maxAge: 15,
    minBirthDate: "2011-01-01",
    maxBirthDate: "2012-12-31",
    maxWeight: 47,
  },
  {
    divisionGroup: "OPEN",
    subGroup: "Kadet (14-15 Thn / 2011-2012)",
    name: "Kadet - Kumite Putri -54 kg",
    categoryType: "KUMITE_INDIVIDUAL",
    gender: "FEMALE",
    minAge: 14,
    maxAge: 15,
    minBirthDate: "2011-01-01",
    maxBirthDate: "2012-12-31",
    minWeight: 47.1,
    maxWeight: 54,
  },
  {
    divisionGroup: "OPEN",
    subGroup: "Kadet (14-15 Thn / 2011-2012)",
    name: "Kadet - Kumite Putri -61 kg",
    categoryType: "KUMITE_INDIVIDUAL",
    gender: "FEMALE",
    minAge: 14,
    maxAge: 15,
    minBirthDate: "2011-01-01",
    maxBirthDate: "2012-12-31",
    minWeight: 54.1,
    maxWeight: 61,
  },
  {
    divisionGroup: "OPEN",
    subGroup: "Kadet (14-15 Thn / 2011-2012)",
    name: "Kadet - Kumite Putri +61 kg",
    categoryType: "KUMITE_INDIVIDUAL",
    gender: "FEMALE",
    minAge: 14,
    maxAge: 15,
    minBirthDate: "2011-01-01",
    maxBirthDate: "2012-12-31",
    minWeight: 61.1,
  },

  // F. JUNIOR (Kelahiran 2009-2010 / Usia 16-17 Tahun)
  {
    divisionGroup: "OPEN",
    subGroup: "Junior (16-17 Thn / 2009-2010)",
    name: "Junior - Kata Perorangan Putra",
    categoryType: "KATA_INDIVIDUAL",
    gender: "MALE",
    minAge: 16,
    maxAge: 17,
    minBirthDate: "2009-01-01",
    maxBirthDate: "2010-12-31",
  },
  {
    divisionGroup: "OPEN",
    subGroup: "Junior (16-17 Thn / 2009-2010)",
    name: "Junior - Kata Perorangan Putri",
    categoryType: "KATA_INDIVIDUAL",
    gender: "FEMALE",
    minAge: 16,
    maxAge: 17,
    minBirthDate: "2009-01-01",
    maxBirthDate: "2010-12-31",
  },
  {
    divisionGroup: "OPEN",
    subGroup: "Junior (16-17 Thn / 2009-2010)",
    name: "Junior - Kata Beregu Putra",
    categoryType: "KATA_TEAM",
    gender: "MALE",
    minAge: 16,
    maxAge: 17,
    minBirthDate: "2009-01-01",
    maxBirthDate: "2010-12-31",
    defaultFee: 250000,
  },
  {
    divisionGroup: "OPEN",
    subGroup: "Junior (16-17 Thn / 2009-2010)",
    name: "Junior - Kata Beregu Putri",
    categoryType: "KATA_TEAM",
    gender: "FEMALE",
    minAge: 16,
    maxAge: 17,
    minBirthDate: "2009-01-01",
    maxBirthDate: "2010-12-31",
    defaultFee: 250000,
  },
  {
    divisionGroup: "OPEN",
    subGroup: "Junior (16-17 Thn / 2009-2010)",
    name: "Junior - Kumite Putra -55 kg",
    categoryType: "KUMITE_INDIVIDUAL",
    gender: "MALE",
    minAge: 16,
    maxAge: 17,
    minBirthDate: "2009-01-01",
    maxBirthDate: "2010-12-31",
    maxWeight: 55,
  },
  {
    divisionGroup: "OPEN",
    subGroup: "Junior (16-17 Thn / 2009-2010)",
    name: "Junior - Kumite Putra -61 kg",
    categoryType: "KUMITE_INDIVIDUAL",
    gender: "MALE",
    minAge: 16,
    maxAge: 17,
    minBirthDate: "2009-01-01",
    maxBirthDate: "2010-12-31",
    minWeight: 55.1,
    maxWeight: 61,
  },
  {
    divisionGroup: "OPEN",
    subGroup: "Junior (16-17 Thn / 2009-2010)",
    name: "Junior - Kumite Putra -68 kg",
    categoryType: "KUMITE_INDIVIDUAL",
    gender: "MALE",
    minAge: 16,
    maxAge: 17,
    minBirthDate: "2009-01-01",
    maxBirthDate: "2010-12-31",
    minWeight: 61.1,
    maxWeight: 68,
  },
  {
    divisionGroup: "OPEN",
    subGroup: "Junior (16-17 Thn / 2009-2010)",
    name: "Junior - Kumite Putra -76 kg",
    categoryType: "KUMITE_INDIVIDUAL",
    gender: "MALE",
    minAge: 16,
    maxAge: 17,
    minBirthDate: "2009-01-01",
    maxBirthDate: "2010-12-31",
    minWeight: 68.1,
    maxWeight: 76,
  },
  {
    divisionGroup: "OPEN",
    subGroup: "Junior (16-17 Thn / 2009-2010)",
    name: "Junior - Kumite Putra +76 kg",
    categoryType: "KUMITE_INDIVIDUAL",
    gender: "MALE",
    minAge: 16,
    maxAge: 17,
    minBirthDate: "2009-01-01",
    maxBirthDate: "2010-12-31",
    minWeight: 76.1,
  },
  {
    divisionGroup: "OPEN",
    subGroup: "Junior (16-17 Thn / 2009-2010)",
    name: "Junior - Kumite Putri -48 kg",
    categoryType: "KUMITE_INDIVIDUAL",
    gender: "FEMALE",
    minAge: 16,
    maxAge: 17,
    minBirthDate: "2009-01-01",
    maxBirthDate: "2010-12-31",
    maxWeight: 48,
  },
  {
    divisionGroup: "OPEN",
    subGroup: "Junior (16-17 Thn / 2009-2010)",
    name: "Junior - Kumite Putri -53 kg",
    categoryType: "KUMITE_INDIVIDUAL",
    gender: "FEMALE",
    minAge: 16,
    maxAge: 17,
    minBirthDate: "2009-01-01",
    maxBirthDate: "2010-12-31",
    minWeight: 48.1,
    maxWeight: 53,
  },
  {
    divisionGroup: "OPEN",
    subGroup: "Junior (16-17 Thn / 2009-2010)",
    name: "Junior - Kumite Putri -59 kg",
    categoryType: "KUMITE_INDIVIDUAL",
    gender: "FEMALE",
    minAge: 16,
    maxAge: 17,
    minBirthDate: "2009-01-01",
    maxBirthDate: "2010-12-31",
    minWeight: 53.1,
    maxWeight: 59,
  },
  {
    divisionGroup: "OPEN",
    subGroup: "Junior (16-17 Thn / 2009-2010)",
    name: "Junior - Kumite Putri -66 kg",
    categoryType: "KUMITE_INDIVIDUAL",
    gender: "FEMALE",
    minAge: 16,
    maxAge: 17,
    minBirthDate: "2009-01-01",
    maxBirthDate: "2010-12-31",
    minWeight: 59.1,
    maxWeight: 66,
  },
  {
    divisionGroup: "OPEN",
    subGroup: "Junior (16-17 Thn / 2009-2010)",
    name: "Junior - Kumite Putri +66 kg",
    categoryType: "KUMITE_INDIVIDUAL",
    gender: "FEMALE",
    minAge: 16,
    maxAge: 17,
    minBirthDate: "2009-01-01",
    maxBirthDate: "2010-12-31",
    minWeight: 66.1,
  },

  // G. U-21 (Kelahiran 2006-2008 / Usia 18-20 Tahun)
  {
    divisionGroup: "OPEN",
    subGroup: "U-21 (18-20 Thn / 2006-2008)",
    name: "U-21 - Kata Perorangan Putra",
    categoryType: "KATA_INDIVIDUAL",
    gender: "MALE",
    minAge: 18,
    maxAge: 20,
    minBirthDate: "2006-01-01",
    maxBirthDate: "2008-12-31",
  },
  {
    divisionGroup: "OPEN",
    subGroup: "U-21 (18-20 Thn / 2006-2008)",
    name: "U-21 - Kata Perorangan Putri",
    categoryType: "KATA_INDIVIDUAL",
    gender: "FEMALE",
    minAge: 18,
    maxAge: 20,
    minBirthDate: "2006-01-01",
    maxBirthDate: "2008-12-31",
  },
  {
    divisionGroup: "OPEN",
    subGroup: "U-21 (18-20 Thn / 2006-2008)",
    name: "U-21 - Kata Beregu Putra",
    categoryType: "KATA_TEAM",
    gender: "MALE",
    minAge: 18,
    maxAge: 20,
    minBirthDate: "2006-01-01",
    maxBirthDate: "2008-12-31",
    defaultFee: 250000,
  },
  {
    divisionGroup: "OPEN",
    subGroup: "U-21 (18-20 Thn / 2006-2008)",
    name: "U-21 - Kata Beregu Putri",
    categoryType: "KATA_TEAM",
    gender: "FEMALE",
    minAge: 18,
    maxAge: 20,
    minBirthDate: "2006-01-01",
    maxBirthDate: "2008-12-31",
    defaultFee: 250000,
  },
  {
    divisionGroup: "OPEN",
    subGroup: "U-21 (18-20 Thn / 2006-2008)",
    name: "U-21 - Kumite Putra -55 kg",
    categoryType: "KUMITE_INDIVIDUAL",
    gender: "MALE",
    minAge: 18,
    maxAge: 20,
    minBirthDate: "2006-01-01",
    maxBirthDate: "2008-12-31",
    maxWeight: 55,
  },
  {
    divisionGroup: "OPEN",
    subGroup: "U-21 (18-20 Thn / 2006-2008)",
    name: "U-21 - Kumite Putra -61 kg",
    categoryType: "KUMITE_INDIVIDUAL",
    gender: "MALE",
    minAge: 18,
    maxAge: 20,
    minBirthDate: "2006-01-01",
    maxBirthDate: "2008-12-31",
    minWeight: 55.1,
    maxWeight: 61,
  },
  {
    divisionGroup: "OPEN",
    subGroup: "U-21 (18-20 Thn / 2006-2008)",
    name: "U-21 - Kumite Putra -68 kg",
    categoryType: "KUMITE_INDIVIDUAL",
    gender: "MALE",
    minAge: 18,
    maxAge: 20,
    minBirthDate: "2006-01-01",
    maxBirthDate: "2008-12-31",
    minWeight: 61.1,
    maxWeight: 68,
  },
  {
    divisionGroup: "OPEN",
    subGroup: "U-21 (18-20 Thn / 2006-2008)",
    name: "U-21 - Kumite Putra -76 kg",
    categoryType: "KUMITE_INDIVIDUAL",
    gender: "MALE",
    minAge: 18,
    maxAge: 20,
    minBirthDate: "2006-01-01",
    maxBirthDate: "2008-12-31",
    minWeight: 68.1,
    maxWeight: 76,
  },
  {
    divisionGroup: "OPEN",
    subGroup: "U-21 (18-20 Thn / 2006-2008)",
    name: "U-21 - Kumite Putra +76 kg",
    categoryType: "KUMITE_INDIVIDUAL",
    gender: "MALE",
    minAge: 18,
    maxAge: 20,
    minBirthDate: "2006-01-01",
    maxBirthDate: "2008-12-31",
    minWeight: 76.1,
  },
  {
    divisionGroup: "OPEN",
    subGroup: "U-21 (18-20 Thn / 2006-2008)",
    name: "U-21 - Kumite Putri -48 kg",
    categoryType: "KUMITE_INDIVIDUAL",
    gender: "FEMALE",
    minAge: 18,
    maxAge: 20,
    minBirthDate: "2006-01-01",
    maxBirthDate: "2008-12-31",
    maxWeight: 48,
  },
  {
    divisionGroup: "OPEN",
    subGroup: "U-21 (18-20 Thn / 2006-2008)",
    name: "U-21 - Kumite Putri -53 kg",
    categoryType: "KUMITE_INDIVIDUAL",
    gender: "FEMALE",
    minAge: 18,
    maxAge: 20,
    minBirthDate: "2006-01-01",
    maxBirthDate: "2008-12-31",
    minWeight: 48.1,
    maxWeight: 53,
  },
  {
    divisionGroup: "OPEN",
    subGroup: "U-21 (18-20 Thn / 2006-2008)",
    name: "U-21 - Kumite Putri -59 kg",
    categoryType: "KUMITE_INDIVIDUAL",
    gender: "FEMALE",
    minAge: 18,
    maxAge: 20,
    minBirthDate: "2006-01-01",
    maxBirthDate: "2008-12-31",
    minWeight: 53.1,
    maxWeight: 59,
  },
  {
    divisionGroup: "OPEN",
    subGroup: "U-21 (18-20 Thn / 2006-2008)",
    name: "U-21 - Kumite Putri -66 kg",
    categoryType: "KUMITE_INDIVIDUAL",
    gender: "FEMALE",
    minAge: 18,
    maxAge: 20,
    minBirthDate: "2006-01-01",
    maxBirthDate: "2008-12-31",
    minWeight: 59.1,
    maxWeight: 66,
  },
  {
    divisionGroup: "OPEN",
    subGroup: "U-21 (18-20 Thn / 2006-2008)",
    name: "U-21 - Kumite Putri +66 kg",
    categoryType: "KUMITE_INDIVIDUAL",
    gender: "FEMALE",
    minAge: 18,
    maxAge: 20,
    minBirthDate: "2006-01-01",
    maxBirthDate: "2008-12-31",
    minWeight: 66.1,
  },

  // H. SENIOR (Kelahiran 2005 & Sebelumnya / Usia 21+ Tahun)
  {
    divisionGroup: "OPEN",
    subGroup: "Senior (21+ Thn / 2005 & Sblm)",
    name: "Senior - Kata Perorangan Putra",
    categoryType: "KATA_INDIVIDUAL",
    gender: "MALE",
    minAge: 21,
    maxBirthDate: "2005-12-31",
  },
  {
    divisionGroup: "OPEN",
    subGroup: "Senior (21+ Thn / 2005 & Sblm)",
    name: "Senior - Kata Perorangan Putri",
    categoryType: "KATA_INDIVIDUAL",
    gender: "FEMALE",
    minAge: 21,
    maxBirthDate: "2005-12-31",
  },
  {
    divisionGroup: "OPEN",
    subGroup: "Senior (21+ Thn / 2005 & Sblm)",
    name: "Senior - Kata Beregu Putra",
    categoryType: "KATA_TEAM",
    gender: "MALE",
    minAge: 21,
    maxBirthDate: "2005-12-31",
    defaultFee: 250000,
  },
  {
    divisionGroup: "OPEN",
    subGroup: "Senior (21+ Thn / 2005 & Sblm)",
    name: "Senior - Kata Beregu Putri",
    categoryType: "KATA_TEAM",
    gender: "FEMALE",
    minAge: 21,
    maxBirthDate: "2005-12-31",
    defaultFee: 250000,
  },
  {
    divisionGroup: "OPEN",
    subGroup: "Senior (21+ Thn / 2005 & Sblm)",
    name: "Senior - Kumite Putra -55 kg",
    categoryType: "KUMITE_INDIVIDUAL",
    gender: "MALE",
    minAge: 21,
    maxBirthDate: "2005-12-31",
    maxWeight: 55,
  },
  {
    divisionGroup: "OPEN",
    subGroup: "Senior (21+ Thn / 2005 & Sblm)",
    name: "Senior - Kumite Putra -60 kg",
    categoryType: "KUMITE_INDIVIDUAL",
    gender: "MALE",
    minAge: 21,
    maxBirthDate: "2005-12-31",
    minWeight: 55.1,
    maxWeight: 60,
  },
  {
    divisionGroup: "OPEN",
    subGroup: "Senior (21+ Thn / 2005 & Sblm)",
    name: "Senior - Kumite Putra -67 kg",
    categoryType: "KUMITE_INDIVIDUAL",
    gender: "MALE",
    minAge: 21,
    maxBirthDate: "2005-12-31",
    minWeight: 60.1,
    maxWeight: 67,
  },
  {
    divisionGroup: "OPEN",
    subGroup: "Senior (21+ Thn / 2005 & Sblm)",
    name: "Senior - Kumite Putra -75 kg",
    categoryType: "KUMITE_INDIVIDUAL",
    gender: "MALE",
    minAge: 21,
    maxBirthDate: "2005-12-31",
    minWeight: 67.1,
    maxWeight: 75,
  },
  {
    divisionGroup: "OPEN",
    subGroup: "Senior (21+ Thn / 2005 & Sblm)",
    name: "Senior - Kumite Putra -84 kg",
    categoryType: "KUMITE_INDIVIDUAL",
    gender: "MALE",
    minAge: 21,
    maxBirthDate: "2005-12-31",
    minWeight: 75.1,
    maxWeight: 84,
  },
  {
    divisionGroup: "OPEN",
    subGroup: "Senior (21+ Thn / 2005 & Sblm)",
    name: "Senior - Kumite Putra +84 kg",
    categoryType: "KUMITE_INDIVIDUAL",
    gender: "MALE",
    minAge: 21,
    maxBirthDate: "2005-12-31",
    minWeight: 84.1,
  },
  {
    divisionGroup: "OPEN",
    subGroup: "Senior (21+ Thn / 2005 & Sblm)",
    name: "Senior - Kumite Putri -50 kg",
    categoryType: "KUMITE_INDIVIDUAL",
    gender: "FEMALE",
    minAge: 21,
    maxBirthDate: "2005-12-31",
    maxWeight: 50,
  },
  {
    divisionGroup: "OPEN",
    subGroup: "Senior (21+ Thn / 2005 & Sblm)",
    name: "Senior - Kumite Putri -55 kg",
    categoryType: "KUMITE_INDIVIDUAL",
    gender: "FEMALE",
    minAge: 21,
    maxBirthDate: "2005-12-31",
    minWeight: 50.1,
    maxWeight: 55,
  },
  {
    divisionGroup: "OPEN",
    subGroup: "Senior (21+ Thn / 2005 & Sblm)",
    name: "Senior - Kumite Putri -61 kg",
    categoryType: "KUMITE_INDIVIDUAL",
    gender: "FEMALE",
    minAge: 21,
    maxBirthDate: "2005-12-31",
    minWeight: 55.1,
    maxWeight: 61,
  },
  {
    divisionGroup: "OPEN",
    subGroup: "Senior (21+ Thn / 2005 & Sblm)",
    name: "Senior - Kumite Putri -68 kg",
    categoryType: "KUMITE_INDIVIDUAL",
    gender: "FEMALE",
    minAge: 21,
    maxBirthDate: "2005-12-31",
    minWeight: 61.1,
    maxWeight: 68,
  },
  {
    divisionGroup: "OPEN",
    subGroup: "Senior (21+ Thn / 2005 & Sblm)",
    name: "Senior - Kumite Putri +68 kg",
    categoryType: "KUMITE_INDIVIDUAL",
    gender: "FEMALE",
    minAge: 21,
    maxBirthDate: "2005-12-31",
    minWeight: 68.1,
  },

  // I. KUMITE BEREGU TERBUKA
  {
    divisionGroup: "OPEN",
    subGroup: "Kumite Beregu Terbuka",
    name: "Kumite Beregu Putra Kadet-Junior",
    categoryType: "KUMITE_TEAM",
    gender: "MALE",
    minAge: 14,
    maxAge: 17,
    defaultFee: 300000,
  },
  {
    divisionGroup: "OPEN",
    subGroup: "Kumite Beregu Terbuka",
    name: "Kumite Beregu Putri Kadet-Junior",
    categoryType: "KUMITE_TEAM",
    gender: "FEMALE",
    minAge: 14,
    maxAge: 17,
    defaultFee: 300000,
  },
  {
    divisionGroup: "OPEN",
    subGroup: "Kumite Beregu Terbuka",
    name: "Kumite Beregu Putra U21-Senior",
    categoryType: "KUMITE_TEAM",
    gender: "MALE",
    minAge: 18,
    defaultFee: 300000,
  },
  {
    divisionGroup: "OPEN",
    subGroup: "Kumite Beregu Terbuka",
    name: "Kumite Beregu Putri U21-Senior",
    categoryType: "KUMITE_TEAM",
    gender: "FEMALE",
    minAge: 18,
    defaultFee: 300000,
  },

  // ==================================================
  // 2. KATEGORI PELAJAR
  // ==================================================
  // A. PELAJAR TK
  {
    divisionGroup: "PELAJAR",
    subGroup: "Pelajar TK",
    name: "Pelajar TK Kata Perorangan Putra",
    categoryType: "KATA_INDIVIDUAL",
    gender: "MALE",
  },
  {
    divisionGroup: "PELAJAR",
    subGroup: "Pelajar TK",
    name: "Pelajar TK Kata Perorangan Putri",
    categoryType: "KATA_INDIVIDUAL",
    gender: "FEMALE",
  },
  {
    divisionGroup: "PELAJAR",
    subGroup: "Pelajar TK",
    name: "Pelajar TK Kumite Perorangan Putra Bebas",
    categoryType: "KUMITE_INDIVIDUAL",
    gender: "MALE",
  },
  {
    divisionGroup: "PELAJAR",
    subGroup: "Pelajar TK",
    name: "Pelajar TK Kumite Perorangan Putri Bebas",
    categoryType: "KUMITE_INDIVIDUAL",
    gender: "FEMALE",
  },

  // B. PELAJAR SD KELAS 1-3
  {
    divisionGroup: "PELAJAR",
    subGroup: "Pelajar SD Kelas 1-3",
    name: "Pelajar SD Kelas 1-3 Kata Perorangan Putra",
    categoryType: "KATA_INDIVIDUAL",
    gender: "MALE",
  },
  {
    divisionGroup: "PELAJAR",
    subGroup: "Pelajar SD Kelas 1-3",
    name: "Pelajar SD Kelas 1-3 Kata Perorangan Putri",
    categoryType: "KATA_INDIVIDUAL",
    gender: "FEMALE",
  },
  {
    divisionGroup: "PELAJAR",
    subGroup: "Pelajar SD Kelas 1-3",
    name: "Pelajar SD Kelas 1-3 Kumite Perorangan Putra -25 kg",
    categoryType: "KUMITE_INDIVIDUAL",
    gender: "MALE",
    maxWeight: 25,
  },
  {
    divisionGroup: "PELAJAR",
    subGroup: "Pelajar SD Kelas 1-3",
    name: "Pelajar SD Kelas 1-3 Kumite Perorangan Putra +25 kg",
    categoryType: "KUMITE_INDIVIDUAL",
    gender: "MALE",
    minWeight: 25.1,
  },
  {
    divisionGroup: "PELAJAR",
    subGroup: "Pelajar SD Kelas 1-3",
    name: "Pelajar SD Kelas 1-3 Kumite Perorangan Putri -25 kg",
    categoryType: "KUMITE_INDIVIDUAL",
    gender: "FEMALE",
    maxWeight: 25,
  },
  {
    divisionGroup: "PELAJAR",
    subGroup: "Pelajar SD Kelas 1-3",
    name: "Pelajar SD Kelas 1-3 Kumite Perorangan Putri +25 kg",
    categoryType: "KUMITE_INDIVIDUAL",
    gender: "FEMALE",
    minWeight: 25.1,
  },

  // C. PELAJAR SD KELAS 4-6
  {
    divisionGroup: "PELAJAR",
    subGroup: "Pelajar SD Kelas 4-6",
    name: "Pelajar SD Kelas 4-6 Kata Perorangan Putra",
    categoryType: "KATA_INDIVIDUAL",
    gender: "MALE",
  },
  {
    divisionGroup: "PELAJAR",
    subGroup: "Pelajar SD Kelas 4-6",
    name: "Pelajar SD Kelas 4-6 Kata Perorangan Putri",
    categoryType: "KATA_INDIVIDUAL",
    gender: "FEMALE",
  },
  {
    divisionGroup: "PELAJAR",
    subGroup: "Pelajar SD Kelas 4-6",
    name: "Pelajar SD Kelas 4-6 Kumite Perorangan Putra -30 kg",
    categoryType: "KUMITE_INDIVIDUAL",
    gender: "MALE",
    maxWeight: 30,
  },
  {
    divisionGroup: "PELAJAR",
    subGroup: "Pelajar SD Kelas 4-6",
    name: "Pelajar SD Kelas 4-6 Kumite Perorangan Putra +30 kg",
    categoryType: "KUMITE_INDIVIDUAL",
    gender: "MALE",
    minWeight: 30.1,
  },
  {
    divisionGroup: "PELAJAR",
    subGroup: "Pelajar SD Kelas 4-6",
    name: "Pelajar SD Kelas 4-6 Kumite Perorangan Putri -30 kg",
    categoryType: "KUMITE_INDIVIDUAL",
    gender: "FEMALE",
    maxWeight: 30,
  },
  {
    divisionGroup: "PELAJAR",
    subGroup: "Pelajar SD Kelas 4-6",
    name: "Pelajar SD Kelas 4-6 Kumite Perorangan Putri +30 kg",
    categoryType: "KUMITE_INDIVIDUAL",
    gender: "FEMALE",
    minWeight: 30.1,
  },

  // D. PELAJAR SMP / MTs
  {
    divisionGroup: "PELAJAR",
    subGroup: "Pelajar SMP / MTs",
    name: "Pelajar SMP/MTs Kata Perorangan Putra",
    categoryType: "KATA_INDIVIDUAL",
    gender: "MALE",
  },
  {
    divisionGroup: "PELAJAR",
    subGroup: "Pelajar SMP / MTs",
    name: "Pelajar SMP/MTs Kata Perorangan Putri",
    categoryType: "KATA_INDIVIDUAL",
    gender: "FEMALE",
  },
  {
    divisionGroup: "PELAJAR",
    subGroup: "Pelajar SMP / MTs",
    name: "Pelajar SMP/MTs Kumite Perorangan Putra -40 kg",
    categoryType: "KUMITE_INDIVIDUAL",
    gender: "MALE",
    maxWeight: 40,
  },
  {
    divisionGroup: "PELAJAR",
    subGroup: "Pelajar SMP / MTs",
    name: "Pelajar SMP/MTs Kumite Perorangan Putra +40 kg",
    categoryType: "KUMITE_INDIVIDUAL",
    gender: "MALE",
    minWeight: 40.1,
  },
  {
    divisionGroup: "PELAJAR",
    subGroup: "Pelajar SMP / MTs",
    name: "Pelajar SMP/MTs Kumite Perorangan Putri -40 kg",
    categoryType: "KUMITE_INDIVIDUAL",
    gender: "FEMALE",
    maxWeight: 40,
  },
  {
    divisionGroup: "PELAJAR",
    subGroup: "Pelajar SMP / MTs",
    name: "Pelajar SMP/MTs Kumite Perorangan Putri +40 kg",
    categoryType: "KUMITE_INDIVIDUAL",
    gender: "FEMALE",
    minWeight: 40.1,
  },

  // E. PELAJAR SMA / SMK / MA
  {
    divisionGroup: "PELAJAR",
    subGroup: "Pelajar SMA / SMK / MA",
    name: "Pelajar SMA/SMK/MA Kata Perorangan Putra",
    categoryType: "KATA_INDIVIDUAL",
    gender: "MALE",
  },
  {
    divisionGroup: "PELAJAR",
    subGroup: "Pelajar SMA / SMK / MA",
    name: "Pelajar SMA/SMK/MA Kata Perorangan Putri",
    categoryType: "KATA_INDIVIDUAL",
    gender: "FEMALE",
  },
  {
    divisionGroup: "PELAJAR",
    subGroup: "Pelajar SMA / SMK / MA",
    name: "Pelajar SMA/SMK/MA Kumite Perorangan Putra -50 kg",
    categoryType: "KUMITE_INDIVIDUAL",
    gender: "MALE",
    maxWeight: 50,
  },
  {
    divisionGroup: "PELAJAR",
    subGroup: "Pelajar SMA / SMK / MA",
    name: "Pelajar SMA/SMK/MA Kumite Perorangan Putra +50 kg",
    categoryType: "KUMITE_INDIVIDUAL",
    gender: "MALE",
    minWeight: 50.1,
  },
  {
    divisionGroup: "PELAJAR",
    subGroup: "Pelajar SMA / SMK / MA",
    name: "Pelajar SMA/SMK/MA Kumite Perorangan Putri -50 kg",
    categoryType: "KUMITE_INDIVIDUAL",
    gender: "FEMALE",
    maxWeight: 50,
  },
  {
    divisionGroup: "PELAJAR",
    subGroup: "Pelajar SMA / SMK / MA",
    name: "Pelajar SMA/SMK/MA Kumite Perorangan Putri +50 kg",
    categoryType: "KUMITE_INDIVIDUAL",
    gender: "FEMALE",
    minWeight: 50.1,
  },

  // F. PELAJAR MAHASISWA / UMUM
  {
    divisionGroup: "PELAJAR",
    subGroup: "Pelajar Mahasiswa / Umum",
    name: "Pelajar Mahasiswa/Umum Kata Perorangan Putra",
    categoryType: "KATA_INDIVIDUAL",
    gender: "MALE",
  },
  {
    divisionGroup: "PELAJAR",
    subGroup: "Pelajar Mahasiswa / Umum",
    name: "Pelajar Mahasiswa/Umum Kata Perorangan Putri",
    categoryType: "KATA_INDIVIDUAL",
    gender: "FEMALE",
  },
  {
    divisionGroup: "PELAJAR",
    subGroup: "Pelajar Mahasiswa / Umum",
    name: "Pelajar Mahasiswa/Umum Kumite Perorangan Putra -67 kg",
    categoryType: "KUMITE_INDIVIDUAL",
    gender: "MALE",
    maxWeight: 67,
  },
  {
    divisionGroup: "PELAJAR",
    subGroup: "Pelajar Mahasiswa / Umum",
    name: "Pelajar Mahasiswa/Umum Kumite Perorangan Putra +67 kg",
    categoryType: "KUMITE_INDIVIDUAL",
    gender: "MALE",
    minWeight: 67.1,
  },
  {
    divisionGroup: "PELAJAR",
    subGroup: "Pelajar Mahasiswa / Umum",
    name: "Pelajar Mahasiswa/Umum Kumite Perorangan Putri -61 kg",
    categoryType: "KUMITE_INDIVIDUAL",
    gender: "FEMALE",
    maxWeight: 61,
  },
  {
    divisionGroup: "PELAJAR",
    subGroup: "Pelajar Mahasiswa / Umum",
    name: "Pelajar Mahasiswa/Umum Kumite Perorangan Putri +61 kg",
    categoryType: "KUMITE_INDIVIDUAL",
    gender: "FEMALE",
    minWeight: 61.1,
  },

  // ==================================================
  // 3. KATEGORI EKSEBISI DISABILITAS
  // ==================================================
  {
    divisionGroup: "DISABILITAS",
    subGroup: "Eksebisi Disabilitas",
    name: "Kata Perorangan Putra Disabilitas Rungu/Wicara",
    categoryType: "KATA_INDIVIDUAL",
    gender: "MALE",
  },
  {
    divisionGroup: "DISABILITAS",
    subGroup: "Eksebisi Disabilitas",
    name: "Kata Perorangan Putra Disabilitas Daksa",
    categoryType: "KATA_INDIVIDUAL",
    gender: "MALE",
  },
  {
    divisionGroup: "DISABILITAS",
    subGroup: "Eksebisi Disabilitas",
    name: "Kata Perorangan Putra Disabilitas Grahita",
    categoryType: "KATA_INDIVIDUAL",
    gender: "MALE",
  },
  {
    divisionGroup: "DISABILITAS",
    subGroup: "Eksebisi Disabilitas",
    name: "Kata Perorangan Putri Disabilitas Rungu/Wicara",
    categoryType: "KATA_INDIVIDUAL",
    gender: "FEMALE",
  },
  {
    divisionGroup: "DISABILITAS",
    subGroup: "Eksebisi Disabilitas",
    name: "Kata Perorangan Putri Disabilitas Daksa",
    categoryType: "KATA_INDIVIDUAL",
    gender: "FEMALE",
  },
  {
    divisionGroup: "DISABILITAS",
    subGroup: "Eksebisi Disabilitas",
    name: "Kata Perorangan Putri Disabilitas Grahita",
    categoryType: "KATA_INDIVIDUAL",
    gender: "FEMALE",
  },

  // ==================================================
  // 4. KATEGORI VETERAN
  // ==================================================
  // A. KATA PERORANGAN VETERAN
  {
    divisionGroup: "VETERAN",
    subGroup: "Kata Perorangan Veteran",
    name: "Kata Perorangan Putra 30-40 Tahun",
    categoryType: "KATA_INDIVIDUAL",
    gender: "MALE",
    minAge: 30,
    maxAge: 40,
  },
  {
    divisionGroup: "VETERAN",
    subGroup: "Kata Perorangan Veteran",
    name: "Kata Perorangan Putra 40-50 Tahun",
    categoryType: "KATA_INDIVIDUAL",
    gender: "MALE",
    minAge: 40,
    maxAge: 50,
  },
  {
    divisionGroup: "VETERAN",
    subGroup: "Kata Perorangan Veteran",
    name: "Kata Perorangan Putra +50 Tahun",
    categoryType: "KATA_INDIVIDUAL",
    gender: "MALE",
    minAge: 50,
  },
  {
    divisionGroup: "VETERAN",
    subGroup: "Kata Perorangan Veteran",
    name: "Kata Perorangan Putri 30-40 Tahun",
    categoryType: "KATA_INDIVIDUAL",
    gender: "FEMALE",
    minAge: 30,
    maxAge: 40,
  },
  {
    divisionGroup: "VETERAN",
    subGroup: "Kata Perorangan Veteran",
    name: "Kata Perorangan Putri 40-50 Tahun",
    categoryType: "KATA_INDIVIDUAL",
    gender: "FEMALE",
    minAge: 40,
    maxAge: 50,
  },
  {
    divisionGroup: "VETERAN",
    subGroup: "Kata Perorangan Veteran",
    name: "Kata Perorangan Putri +50 Tahun",
    categoryType: "KATA_INDIVIDUAL",
    gender: "FEMALE",
    minAge: 50,
  },

  // B. KUMITE PERORANGAN VETERAN
  {
    divisionGroup: "VETERAN",
    subGroup: "Kumite Perorangan Veteran",
    name: "Kumite Perorangan Putra 30-40 Tahun",
    categoryType: "KUMITE_INDIVIDUAL",
    gender: "MALE",
    minAge: 30,
    maxAge: 40,
  },
  {
    divisionGroup: "VETERAN",
    subGroup: "Kumite Perorangan Veteran",
    name: "Kumite Perorangan Putra 40-50 Tahun",
    categoryType: "KUMITE_INDIVIDUAL",
    gender: "MALE",
    minAge: 40,
    maxAge: 50,
  },
  {
    divisionGroup: "VETERAN",
    subGroup: "Kumite Perorangan Veteran",
    name: "Kumite Perorangan Putra +50 Tahun",
    categoryType: "KUMITE_INDIVIDUAL",
    gender: "MALE",
    minAge: 50,
  },
  {
    divisionGroup: "VETERAN",
    subGroup: "Kumite Perorangan Veteran",
    name: "Kumite Perorangan Putri +50 Tahun",
    categoryType: "KUMITE_INDIVIDUAL",
    gender: "FEMALE",
    minAge: 50,
  },

  // ==================================================
  // 5. KATEGORI BEST OF THE BEST (BOB)
  // ==================================================
  {
    divisionGroup: "BOB",
    subGroup: "Best of the Best",
    name: "BOB Kumite Kadet - Junior Putra",
    categoryType: "KUMITE_INDIVIDUAL",
    gender: "MALE",
    minAge: 14,
    maxAge: 17,
    defaultFee: 200000,
  },
  {
    divisionGroup: "BOB",
    subGroup: "Best of the Best",
    name: "BOB Kumite Kadet - Junior Putri",
    categoryType: "KUMITE_INDIVIDUAL",
    gender: "FEMALE",
    minAge: 14,
    maxAge: 17,
    defaultFee: 200000,
  },
  {
    divisionGroup: "BOB",
    subGroup: "Best of the Best",
    name: "BOB Kumite U21 - Senior Putra",
    categoryType: "KUMITE_INDIVIDUAL",
    gender: "MALE",
    minAge: 18,
    defaultFee: 200000,
  },
  {
    divisionGroup: "BOB",
    subGroup: "Best of the Best",
    name: "BOB Kumite U21 - Senior Putri",
    categoryType: "KUMITE_INDIVIDUAL",
    gender: "FEMALE",
    minAge: 18,
    defaultFee: 200000,
  },
  {
    divisionGroup: "BOB",
    subGroup: "Best of the Best",
    name: "BOB Kata Kadet - Senior Putra",
    categoryType: "KATA_INDIVIDUAL",
    gender: "MALE",
    minAge: 14,
    defaultFee: 200000,
  },
  {
    divisionGroup: "BOB",
    subGroup: "Best of the Best",
    name: "BOB Kata Kadet - Senior Putri",
    categoryType: "KATA_INDIVIDUAL",
    gender: "FEMALE",
    minAge: 14,
    defaultFee: 200000,
  },
];

export function deriveAgeCategoryLabel(
  categoryName: string = "",
  minAge?: number | null,
  maxAge?: number | null,
  birthDate?: string | Date | null
): string {
  const name = (categoryName || "").trim();
  const upper = name.toUpperCase();

  // 1. Check keyword in category name first
  if (upper.includes("PRA USIA DINI") || upper.includes("PRA-USIA DINI")) return "Pra Usia Dini (6-7 Thn)";
  if (upper.includes("USIA DINI")) return "Usia Dini (8-9 Thn)";
  if (upper.includes("PRA PEMULA") || upper.includes("PRA-PEMULA")) return "Pra Pemula (10-11 Thn)";
  if (upper.includes("PEMULA")) return "Pemula (12-13 Thn)";
  if (upper.includes("KADET")) return "Kadet (14-15 Thn)";
  if (upper.includes("JUNIOR")) return "Junior (16-17 Thn)";
  if (upper.includes("U-21") || upper.includes("U21") || upper.includes("UNDER 21") || upper.includes("UNDER-21")) return "U-21 (18-20 Thn)";
  if (upper.includes("SENIOR")) return "Senior (21+ Thn)";
  if (upper.includes("PELAJAR TK") || upper.includes("TK ")) return "Pelajar TK";
  if (upper.includes("SD KELAS 1-3") || upper.includes("SD 1-3")) return "Pelajar SD (1-3)";
  if (upper.includes("SD KELAS 4-6") || upper.includes("SD 4-6") || upper.includes("PELAJAR SD")) return "Pelajar SD (4-6)";
  if (upper.includes("SMP") || upper.includes("MTS")) return "Pelajar SMP / MTs";
  if (upper.includes("SMA") || upper.includes("SMK") || upper.includes("MA ")) return "Pelajar SMA / SMK / MA";
  if (upper.includes("MAHASISWA") || upper.includes("UMUM")) return "Pelajar Mahasiswa / Umum";
  if (upper.includes("DISABILITAS") || upper.includes("RUNGU") || upper.includes("DAKSA") || upper.includes("GRAHITA")) return "Eksebisi Disabilitas";
  if (upper.includes("VETERAN")) {
    if (upper.includes("30-40")) return "Veteran (30-40 Thn)";
    if (upper.includes("40-50")) return "Veteran (40-50 Thn)";
    if (upper.includes("+50") || upper.includes("50+")) return "Veteran (+50 Thn)";
    return "Veteran (30+ Thn)";
  }
  if (upper.includes("BOB") || upper.includes("BEST OF THE BEST")) return "Best of the Best";

  // Helper to map numeric age to standard Karate division label
  const getLabelFromAgeNumber = (age: number): string => {
    if (age <= 7) return "Pra Usia Dini (6-7 Thn)";
    if (age >= 8 && age <= 9) return "Usia Dini (8-9 Thn)";
    if (age >= 10 && age <= 11) return "Pra Pemula (10-11 Thn)";
    if (age >= 12 && age <= 13) return "Pemula (12-13 Thn)";
    if (age >= 14 && age <= 15) return "Kadet (14-15 Thn)";
    if (age >= 16 && age <= 17) return "Junior (16-17 Thn)";
    if (age >= 18 && age <= 20) return "U-21 (18-20 Thn)";
    if (age >= 21 && age <= 29) return "Senior (21+ Thn)";
    if (age >= 30 && age <= 40) return "Veteran (30-40 Thn)";
    if (age >= 41 && age <= 50) return "Veteran (40-50 Thn)";
    if (age > 50) return "Veteran (+50 Thn)";
    return `Usia ${age} Thn`;
  };

  // 2. Derive from birthDate if available
  if (birthDate) {
    const bYear = new Date(birthDate).getFullYear();
    const currentYear = new Date().getFullYear();
    const age = currentYear - bYear;
    if (age > 0 && age < 100) {
      return getLabelFromAgeNumber(age);
    }
  }

  // 3. Derive from minAge / maxAge if available
  if (minAge || maxAge) {
    const ageRef = minAge || maxAge || 0;
    if (ageRef > 0) {
      return getLabelFromAgeNumber(ageRef);
    }
  }

  return "Umum / Bebas";
}

/**
 * Format nomor pertandingan resmi dan bersih (misal: "Kata Perorangan", "Kumite -25 kg")
 * bebas dari kode enum mentah (seperti KATA_INDIVIDUAL / KUMITE_INDIVIDUAL).
 */
export function formatEventNumberDisplay(
  categoryType?: string | null,
  minWeight?: number | null,
  maxWeight?: number | null
): string {
  const type = (categoryType || "").toUpperCase();
  const isTeam = type.endsWith("_TEAM");

  if (type.startsWith("KATA")) {
    return isTeam ? "Kata Beregu" : "Kata Perorangan";
  }

  // Kumite
  const base = isTeam ? "Kumite Beregu" : "Kumite";
  if (maxWeight && !minWeight) {
    return `${base} -${maxWeight} kg`;
  }
  if (minWeight && !maxWeight) {
    return `${base} +${Math.floor(minWeight)} kg`;
  }
  if (minWeight && maxWeight) {
    return `${base} ${minWeight}-${maxWeight} kg`;
  }
  return isTeam ? "Kumite Beregu" : "Kumite Perorangan";
}

/**
 * Label gender bahasa Indonesia yang ramah pembaca
 */
export function formatGenderLabel(gender?: string | null): string {
  if (gender === "MALE") return "Putra";
  if (gender === "FEMALE") return "Putri";
  if (gender === "MIXED") return "Campuran";
  return gender || "-";
}

/**
 * Label batas berat badan bersih
 */
export function formatWeightLimitLabel(minWeight?: number | null, maxWeight?: number | null): string {
  if (maxWeight && !minWeight) return `-${maxWeight} kg`;
  if (minWeight && !maxWeight) return `+${Math.floor(minWeight)} kg`;
  if (minWeight && maxWeight) return `${minWeight} - ${maxWeight} kg`;
  return "Bebas BB";
}

/**
 * Format label option select dropdown untuk pemilihan kelas pertandingan
 * Bebas dari raw code teknis seperti (KATA_INDIVIDUAL · MALE).
 */
export function formatCategoryOptionLabel(cat: {
  name: string;
  categoryType?: string | null;
  gender?: string | null;
  minWeight?: number | null;
  maxWeight?: number | null;
  fee?: number | null;
  isFeeVisible?: boolean | null;
}): string {
  const nomor = formatEventNumberDisplay(cat.categoryType, cat.minWeight, cat.maxWeight);
  const gender = formatGenderLabel(cat.gender);
  const feeStr =
    cat.isFeeVisible !== false && cat.fee !== undefined && cat.fee !== null
      ? ` — Rp ${cat.fee.toLocaleString("id-ID")}`
    : "";

  return `${cat.name} — ${nomor} (${gender})${feeStr}`;
}

export interface DivisionPresetDef {
  id: string;
  name: string;
  ageLabel: string;
  minAge: number | null;
  maxAge: number | null;
  defaultMinBirth: string;
  defaultMaxBirth: string;
  weights: string[];
}

export const DIVISION_PRESETS: DivisionPresetDef[] = [
  {
    id: "PRA_USIA_DINI",
    name: "PRA USIA DINI",
    ageLabel: "6 - 7 TAHUN",
    minAge: 6,
    maxAge: 7,
    defaultMinBirth: "2019-04-10",
    defaultMaxBirth: "2021-04-09",
    weights: ["BEBAS", "-20", "-25", "+25"],
  },
  {
    id: "USIA_DINI",
    name: "USIA DINI",
    ageLabel: "8 - 9 TAHUN",
    minAge: 8,
    maxAge: 9,
    defaultMinBirth: "2017-04-10",
    defaultMaxBirth: "2019-04-09",
    weights: ["BEBAS", "-25", "-30", "+30", "-35", "+35"],
  },
  {
    id: "PRA_PEMULA",
    name: "PRA PEMULA",
    ageLabel: "10 - 11 TAHUN",
    minAge: 10,
    maxAge: 11,
    defaultMinBirth: "2015-04-10",
    defaultMaxBirth: "2017-04-09",
    weights: ["BEBAS", "-35", "-40", "+40", "-45", "+45"],
  },
  {
    id: "PEMULA",
    name: "PEMULA",
    ageLabel: "12 - 13 TAHUN",
    minAge: 12,
    maxAge: 13,
    defaultMinBirth: "2013-04-10",
    defaultMaxBirth: "2015-04-09",
    weights: ["BEBAS", "-35", "-40", "-45", "-50", "+50"],
  },
  {
    id: "KADET",
    name: "KADET",
    ageLabel: "14 - 15 TAHUN",
    minAge: 14,
    maxAge: 15,
    defaultMinBirth: "2011-04-10",
    defaultMaxBirth: "2013-04-09",
    weights: ["BEBAS", "-47", "-52", "-54", "-57", "-63", "-70", "+70"],
  },
  {
    id: "JUNIOR",
    name: "JUNIOR",
    ageLabel: "16 - 17 TAHUN",
    minAge: 16,
    maxAge: 17,
    defaultMinBirth: "2009-04-10",
    defaultMaxBirth: "2011-04-09",
    weights: ["BEBAS", "-48", "-53", "-55", "-59", "-61", "-68", "-76", "+76"],
  },
  {
    id: "UNDER_21",
    name: "UNDER-21 (U-21)",
    ageLabel: "18 - 20 TAHUN",
    minAge: 18,
    maxAge: 20,
    defaultMinBirth: "2006-04-10",
    defaultMaxBirth: "2009-04-09",
    weights: ["BEBAS", "-50", "-55", "-60", "-67", "-75", "-84", "+84"],
  },
  {
    id: "SENIOR",
    name: "SENIOR / UMUM",
    ageLabel: "21+ TAHUN",
    minAge: 21,
    maxAge: null,
    defaultMinBirth: "",
    defaultMaxBirth: "2006-04-09",
    weights: ["BEBAS", "-50", "-55", "-60", "-67", "-75", "-84", "+84"],
  },
  {
    id: "VETERAN",
    name: "VETERAN",
    ageLabel: "35+ TAHUN",
    minAge: 35,
    maxAge: null,
    defaultMinBirth: "",
    defaultMaxBirth: "1991-04-09",
    weights: ["BEBAS", "-65", "-75", "+75"],
  },
  {
    id: "CUSTOM",
    name: "KUSTOM / LAINNYA",
    ageLabel: "BEBAS USIA",
    minAge: null,
    maxAge: null,
    defaultMinBirth: "",
    defaultMaxBirth: "",
    weights: ["BEBAS", "-25", "-30", "-35", "-40", "-45", "-50", "+50"],
  },
];

export function detectDivisionPreset(cat: { name?: string | null; minAge?: number | null; maxAge?: number | null }): string {
  const nameUpper = (cat.name || "").toUpperCase();
  for (const p of DIVISION_PRESETS) {
    if (p.id === "CUSTOM") continue;
    if (
      nameUpper.includes(p.name) ||
      (cat.minAge === p.minAge && (cat.maxAge === p.maxAge || (!p.maxAge && !cat.maxAge)))
    ) {
      return p.id;
    }
  }
  return "CUSTOM";
}

export function isBirthDateInRange(
  birthDate: string | Date | null | undefined,
  minBirth: string | Date | null | undefined,
  maxBirth: string | Date | null | undefined
): boolean {
  if (!birthDate) return false;
  const bTime = new Date(birthDate).getTime();
  if (isNaN(bTime)) return false;

  const t1 = minBirth ? new Date(minBirth).getTime() : null;
  const t2 = maxBirth ? new Date(maxBirth).getTime() : null;

  if (t1 !== null && t2 !== null && !isNaN(t1) && !isNaN(t2)) {
    const low = Math.min(t1, t2);
    const high = Math.max(t1, t2) + 86400000 - 1;
    return bTime >= low && bTime <= high;
  }
  if (t1 !== null && !isNaN(t1)) {
    return bTime >= t1;
  }
  if (t2 !== null && !isNaN(t2)) {
    return bTime <= t2 + 86400000 - 1;
  }
  return false;
}

export function isAgeInRange(
  age: number | null | undefined,
  minAge: number | null | undefined,
  maxAge: number | null | undefined
): boolean {
  if (age === null || age === undefined || isNaN(age)) return false;
  if (minAge !== null && minAge !== undefined && !isNaN(minAge) && age < minAge) return false;
  if (maxAge !== null && maxAge !== undefined && !isNaN(maxAge) && age > maxAge) return false;
  return (minAge !== null && minAge !== undefined) || (maxAge !== null && maxAge !== undefined);
}

export function getCategoryDivisionMeta(cat: {
  name?: string | null;
  minAge?: number | null;
  maxAge?: number | null;
  minBirthDate?: string | null;
  maxBirthDate?: string | null;
}): {
  divisionName: string;
  ageLabel: string;
  birthDateLabel: string;
  presetId?: string;
  minBirthDate?: string | null;
  maxBirthDate?: string | null;
  minAge?: number | null;
  maxAge?: number | null;
} {
  const nameUpper = (cat.name || "").toUpperCase();
  for (const p of DIVISION_PRESETS) {
    if (p.id === "CUSTOM") continue;
    if (
      nameUpper.includes(p.name) ||
      (cat.minAge === p.minAge && (cat.maxAge === p.maxAge || (!p.maxAge && !cat.maxAge)))
    ) {
      const effectiveMinBirth = cat.minBirthDate || p.defaultMinBirth || null;
      const effectiveMaxBirth = cat.maxBirthDate || p.defaultMaxBirth || null;
      let bLabel = "";
      if (effectiveMinBirth || effectiveMaxBirth) {
        const d1 = effectiveMinBirth ? new Date(effectiveMinBirth).toLocaleDateString("id-ID", { day: "numeric", month: "long", year: "numeric" }) : "*";
        const d2 = effectiveMaxBirth ? new Date(effectiveMaxBirth).toLocaleDateString("id-ID", { day: "numeric", month: "long", year: "numeric" }) : "*";
        bLabel = `Kelahiran tanggal ${d1} s.d ${d2}`;
      } else {
        bLabel = "Kriteria Usia Standar Kejuaraan";
      }
      return {
        divisionName: p.name,
        ageLabel: p.ageLabel,
        birthDateLabel: bLabel,
        presetId: p.id,
        minBirthDate: effectiveMinBirth,
        maxBirthDate: effectiveMaxBirth,
        minAge: cat.minAge ?? p.minAge ?? null,
        maxAge: cat.maxAge ?? p.maxAge ?? null,
      };
    }
  }

  let bLabel = "Kriteria Usia Standar Kejuaraan";
  if (cat.minBirthDate || cat.maxBirthDate) {
    const d1 = cat.minBirthDate ? new Date(cat.minBirthDate).toLocaleDateString("id-ID", { day: "numeric", month: "long", year: "numeric" }) : "*";
    const d2 = cat.maxBirthDate ? new Date(cat.maxBirthDate).toLocaleDateString("id-ID", { day: "numeric", month: "long", year: "numeric" }) : "*";
    bLabel = `Kelahiran tanggal ${d1} s.d ${d2}`;
  }
  return {
    divisionName: "KELAS LAINNYA",
    ageLabel: cat.minAge || cat.maxAge ? `${cat.minAge || 0} - ${cat.maxAge || "∞"} Tahun` : "Bebas Usia",
    birthDateLabel: bLabel,
    presetId: "CUSTOM",
    minBirthDate: cat.minBirthDate || null,
    maxBirthDate: cat.maxBirthDate || null,
    minAge: cat.minAge ?? null,
    maxAge: cat.maxAge ?? null,
  };
}

export function getEventNumberDisplay(cat: {
  categoryType?: string | null;
  minWeight?: number | string | null;
  maxWeight?: number | string | null;
}): string {
  const type = (cat.categoryType || "").toUpperCase();
  const isTeam = type.endsWith("_TEAM");
  if (type.startsWith("KATA")) {
    return isTeam ? "KATA BEREGU" : "KATA PERORANGAN";
  }
  const prefix = isTeam ? "KUMITE BEREGU" : "KUMITE";

  const minW =
    cat.minWeight !== null && cat.minWeight !== undefined && cat.minWeight !== ""
      ? parseFloat(String(cat.minWeight).replace("+", "").replace(/\s+/g, "").replace(",", "."))
      : null;
  const maxW =
    cat.maxWeight !== null && cat.maxWeight !== undefined && cat.maxWeight !== ""
      ? parseFloat(String(cat.maxWeight).replace("-", "").replace(/\s+/g, "").replace(",", "."))
      : null;

  const validMin = minW !== null && !isNaN(minW) ? minW : null;
  const validMax = maxW !== null && !isNaN(maxW) ? maxW : null;

  if (validMax && !validMin) {
    return `${prefix} -${validMax} KG`;
  }
  if (validMin && !validMax) {
    return `${prefix} +${Math.floor(validMin)} KG`;
  }
  if (validMin && validMax) {
    return `${prefix} ${validMin}-${validMax} KG`;
  }
  return `${prefix} PERORANGAN`;
}

export function buildGeneratedCategoryName(
  divisionPresetId: string,
  categoryType: string,
  gender: string,
  minWeight?: number | string | null,
  maxWeight?: number | string | null
): string {
  const preset = DIVISION_PRESETS.find((p) => p.id === divisionPresetId) || DIVISION_PRESETS[0];
  const divName = preset.name;
  const isKata = (categoryType || "").startsWith("KATA");
  const isTeam = (categoryType || "").endsWith("_TEAM");

  const minW =
    minWeight !== null && minWeight !== undefined && minWeight !== ""
      ? parseFloat(String(minWeight).replace("+", "").replace(/\s+/g, "").replace(",", "."))
      : null;
  const maxW =
    maxWeight !== null && maxWeight !== undefined && maxWeight !== ""
      ? parseFloat(String(maxWeight).replace("-", "").replace(/\s+/g, "").replace(",", "."))
      : null;

  const validMin = minW !== null && !isNaN(minW) ? minW : null;
  const validMax = maxW !== null && !isNaN(maxW) ? maxW : null;

  let numberPart = "";
  if (isKata) {
    numberPart = isTeam ? "KATA BEREGU" : "KATA PERORANGAN";
  } else {
    const kumitePrefix = isTeam ? "KUMITE BEREGU" : "KUMITE";
    if (validMax && !validMin) {
      numberPart = `${kumitePrefix} -${validMax} KG`;
    } else if (validMin && !validMax) {
      numberPart = `${kumitePrefix} +${Math.floor(validMin)} KG`;
    } else if (validMin && validMax) {
      numberPart = `${kumitePrefix} ${validMin}-${validMax} KG`;
    } else {
      numberPart = `${kumitePrefix} PERORANGAN`;
    }
  }

  const genderPart = gender === "FEMALE" ? "PUTRI" : gender === "MIXED" ? "CAMPURAN" : "PUTRA";

  return `${divName} (${numberPart} - ${genderPart})`;
}




